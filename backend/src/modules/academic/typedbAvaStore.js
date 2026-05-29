import { v4 as uuid } from 'uuid';
import { annotatePortfolioPost, createPost, listUserPosts } from '../../repositories/post.repository.js';
import { readQuery, typeqlDatetime, typeqlLiteral, writeQuery } from '../../db/typedb.js';
import { deleteDocumentObject } from '../../services/document.service.js';

function usernameOf(user) {
  return user?.username || user?.id || '';
}

function displayNameOf(user) {
  return user?.displayName || user?.name || usernameOf(user);
}

function roleOf(user) {
  return String(user?.role || 'user').toLowerCase();
}

function isAcademicManager(user) {
  return ['coordination', 'admin', 'super_admin'].includes(roleOf(user));
}

function safe(value) {
  return typeqlLiteral(value || '');
}

function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'portfolio';
}

async function generatePortfolioSlug(username, title) {
  const base = slugify(title);
  const rows = await readQuery(`
    match
      $author isa person, has username "${safe(username)}";
      $post isa post, has portfolio-slug $slug;
      posting(page: $author, post: $post);
    fetch { "slug": $slug };
  `).catch(() => []);
  const used = new Set(rows.map(row => row.slug).filter(Boolean));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function attrs(row, name) {
  return row?.[name] || {};
}

function attr(values, name, fallback = '') {
  const value = values?.[name];
  return value === undefined || value === null ? fallback : value;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function authorizationMatch(user, offering = '$offering') {
  const username = safe(usernameOf(user));
  // $viewer is ALWAYS declared so try{} blocks that use $viewer don't need to re-declare it
  const viewer = `$viewer isa person, has username "${username}";`;
  if (roleOf(user) === 'super_admin') {
    return viewer; // no additional filter – super_admin sees everything
  }
  if (roleOf(user) === 'admin') {
    return `${viewer} $membership isa institution-membership, links (member: $viewer, university: $institution), has institution-status "approved"; { $membership has institution-role "university_admin"; } or { $membership has institution-role "admin"; };`;
  }
  if (roleOf(user) === 'coordination') {
    return `${viewer} $membership isa institution-membership, links (member: $viewer, university: $institution), has institution-status "approved"; $subject isa institution-subject; academic-offering-subject-link(offering: ${offering}, subject: $subject); $managed_course isa institution-course; institution-subject-link(course: $managed_course, subject: $subject); $scope isa institution-course-coordination, links (coordinator: $viewer, course: $managed_course), has institution-status "approved";`;
  }
  if (roleOf(user) === 'professor') {
    return `${viewer} academic-teaching-assignment(teacher: $viewer, offering: ${offering});`;
  }
  return `${viewer} academic-enrollment(student: $viewer, offering: ${offering});`;
}

async function readAccessibleOfferings(user, universityId = '') {
  const institutionFilter = universityId
    ? `$institution has institution-id "${safe(universityId)}";`
    : '';
  const rows = await readQuery(`
    match
      $course isa academic-course;
      $institution isa educational-institute;
      ${institutionFilter}
      $offering isa academic-course-offering, links (course: $course, institution: $institution);
      ${authorizationMatch(user)}
      try {
        $enrolled_viewer isa person, has username "${safe(usernameOf(user))}";
        $own_enrollment isa academic-enrollment, links (student: $enrolled_viewer, offering: $offering);
      };
      try {
        $teacher isa person, has username $teacher_username, has name $teacher_name;
        academic-teaching-assignment(teacher: $teacher, offering: $offering);
      };
    fetch {
      "course": { $course.* },
      "offering": { $offering.* },
      "institution": { $institution.* },
      "enrollment": { $own_enrollment.* },
      "teacher_username": $teacher_username,
      "teacher_name": $teacher_name
    };
  `);
  return rows.map(row => {
    const course = attrs(row, 'course');
    const offering = attrs(row, 'offering');
    const institution = attrs(row, 'institution');
    const enrollment = attrs(row, 'enrollment');
    return {
      id: attr(course, 'academic-course-id'),
      offeringId: attr(offering, 'academic-offering-id'),
      name: attr(course, 'academic-title'),
      code: attr(course, 'academic-code'),
      period: attr(offering, 'academic-period'),
      description: attr(course, 'academic-description'),
      color: attr(course, 'academic-color', '#2563eb'),
      tags: [].concat(course['academic-tag'] || []).filter(Boolean),
      professor: row.teacher_name || 'Professor a designar',
      professorUsername: row.teacher_username || '',
      room: attr(offering, 'academic-room'),
      schedule: attr(offering, 'academic-schedule'),
      institution: {
        id: attr(institution, 'academic-institution-code', attr(institution, 'page-id', 'unigran')),
        name: attr(institution, 'name', 'UNIGRAN'),
      },
      enrollment,
    };
  }).filter(course => course.id);
}

async function readMaterials(offeringId, user) {
  const rows = await readQuery(`
    match
      $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
      $material isa academic-material;
      academic-offering-material(offering: $offering, material: $material);
      ${authorizationMatch(user)}
      try {
        $completion isa academic-material-completion, links (material: $material, student: $viewer);
      };
    fetch { "material": { $material.* }, "completion": { $completion.* } };
  `);
  return rows.map(row => {
    const material = attrs(row, 'material');
    return {
      id: attr(material, 'academic-material-id'),
      title: attr(material, 'academic-title'),
      type: attr(material, 'academic-material-type', 'pdf'),
      duration: attr(material, 'academic-duration'),
      required: attr(material, 'academic-required', true),
      url: attr(material, 'academic-url'),
      documentName: attr(material, 'academic-document-name'),
      storage: attr(material, 'academic-document-storage'),
      documentPath: attr(material, 'academic-document-path'),
      completed: Boolean(attr(attrs(row, 'completion'), 'academic-status')),
    };
  });
}

async function completedMaterialIds(offeringId, user) {
  if (roleOf(user) === 'professor' || isAcademicManager(user)) return new Set();
  const rows = await readQuery(`
    match
      $viewer isa person, has username "${safe(usernameOf(user))}";
      $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
      $material isa academic-material, has academic-material-id $material_id;
      academic-offering-material(offering: $offering, material: $material);
      academic-material-completion(material: $material, student: $viewer);
    fetch { "material_id": $material_id };
  `);
  return new Set(rows.map(row => row.material_id));
}

async function readActivities(offeringId, user) {
  const rows = await readQuery(`
    match
      $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
      $activity isa academic-activity;
      academic-offering-activity(offering: $offering, activity: $activity);
      ${authorizationMatch(user)}
      try {
        $submission isa academic-submission;
        academic-activity-submission(activity: $activity, submission: $submission, student: $viewer);
      };
    fetch {
      "activity": { $activity.* },
      "submission": { $submission.* }
    };
  `);
  const mapped = rows.map(row => {
    const activity = attrs(row, 'activity');
    const submissionAttrs = attrs(row, 'submission');
    const submission = attr(submissionAttrs, 'academic-submission-id') ? mapSubmission(submissionAttrs) : null;
    const due = attr(activity, 'academic-datetime');
    return {
      id: attr(activity, 'academic-activity-id'),
      title: attr(activity, 'academic-title'),
      description: attr(activity, 'academic-description'),
      due,
      points: numberValue(attr(activity, 'academic-points'), 10),
      xp: numberValue(attr(activity, 'academic-xp'), 120),
      status: submission?.status || (due && new Date(due).getTime() < Date.now() ? 'late' : 'pending'),
      submission,
    };
  });
  const latest = new Map();
  for (const activity of mapped) {
    const current = latest.get(activity.id);
    if (!current || String(activity.submission?.updatedAt || '').localeCompare(String(current.submission?.updatedAt || '')) > 0) {
      latest.set(activity.id, activity);
    }
  }
  return [...latest.values()];
}

function mapSubmission(values, extra = {}) {
  return {
    id: attr(values, 'academic-submission-id'),
    content: attr(values, 'academic-content'),
    attachmentUrl: attr(values, 'academic-url'),
    documentUrl: attr(values, 'academic-url'),
    documentName: attr(values, 'academic-document-name'),
    documentStorage: attr(values, 'academic-document-storage'),
    documentPath: attr(values, 'academic-document-path'),
    externalKind: attr(values, 'academic-external-kind'),
    externalLabel: attr(values, 'academic-external-label'),
    feedback: attr(values, 'academic-feedback'),
    portfolioShareUrl: attr(values, 'academic-share-url'),
    status: attr(values, 'academic-status', 'submitted'),
    score: values['academic-score'] == null ? null : numberValue(values['academic-score']),
    updatedAt: attr(values, 'academic-datetime'),
    ...extra,
  };
}

async function readStudents(offeringId) {
  const rows = await readQuery(`
    match
      $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
      $student isa person, has username $username, has name $name;
      $enrollment isa academic-enrollment, links (student: $student, offering: $offering);
    fetch {
      "username": $username,
      "name": $name,
      "enrollment": { $enrollment.* }
    };
  `);
  return rows.map(row => {
    const enrollment = attrs(row, 'enrollment');
    return {
      id: row.username,
      username: row.username,
      name: row.name || row.username,
      registration: attr(enrollment, 'academic-registration'),
      progress: numberValue(attr(enrollment, 'academic-score')),
      attendance: numberValue(attr(enrollment, 'academic-attendance-rate'), 100),
      average: numberValue(attr(enrollment, 'academic-score')),
      risk: attr(enrollment, 'academic-risk', 'Regular'),
    };
  });
}

async function readAttendance(offeringId, user) {
  // $viewer is always declared by authorizationMatch above; just constrain for students
  const viewerFilter = roleOf(user) === 'professor' || isAcademicManager(user)
    ? ''
    : `$viewer is $student;`;
  const rows = await readQuery(`
    match
      $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
      $session isa academic-attendance-session;
      academic-offering-attendance(offering: $offering, session: $session);
      $student isa person, has username $student_username;
      $entry isa academic-attendance-entry, links (session: $session, student: $student);
      ${viewerFilter}
    fetch {
      "session": { $session.* },
      "entry": { $entry.* },
      "student_username": $student_username
    };
  `);
  return rows.map(row => ({
    id: attr(attrs(row, 'session'), 'academic-attendance-session-id'),
    date: attr(attrs(row, 'session'), 'academic-date'),
    topic: attr(attrs(row, 'session'), 'academic-title'),
    studentId: row.student_username,
    status: attr(attrs(row, 'entry'), 'academic-status', 'present'),
    justification: attr(attrs(row, 'entry'), 'academic-justification'),
  }));
}

async function readForum(offeringId, user) {
  const posts = await readQuery(`
    match
      $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
      $post isa academic-forum-post;
      academic-offering-forum(offering: $offering, post: $post);
      ${authorizationMatch(user)}
      $author isa person, has name $author_name;
      try { $author has user-role $author_role; };
      academic-forum-authorship(author: $author, post: $post);
    fetch {
      "post": { $post.* },
      "author_name": $author_name,
      "author_role": $author_role
    };
  `);
  const result = [];
  for (const row of posts) {
    const post = attrs(row, 'post');
    const postId = attr(post, 'academic-forum-post-id');
    const comments = await readQuery(`
      match
        $post isa academic-forum-post, has academic-forum-post-id "${safe(postId)}";
        $comment isa academic-forum-comment;
        $author isa person, has name $author_name;
        academic-forum-comment-link(post: $post, comment: $comment, author: $author);
      fetch { "comment": { $comment.* }, "author_name": $author_name };
    `);
    result.push({
      id: postId,
      author: row.author_name,
      role: row.author_role || 'aluno',
      content: attr(post, 'academic-content'),
      createdAt: attr(post, 'academic-datetime'),
      comments: comments.map(commentRow => ({
        id: attr(attrs(commentRow, 'comment'), 'academic-forum-comment-id'),
        author: commentRow.author_name,
        content: attr(attrs(commentRow, 'comment'), 'academic-content'),
        createdAt: attr(attrs(commentRow, 'comment'), 'academic-datetime'),
      })),
    });
  }
  return result.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function buildCourses(user, universityId = '') {
  const baseCourses = await readAccessibleOfferings(user, universityId);
  const manage = roleOf(user) === 'professor' || isAcademicManager(user);
  return Promise.all(baseCourses.map(async course => {
    const [materials, completed, activities, students, attendanceRecords, forum] = await Promise.all([
      readMaterials(course.offeringId, user),
      completedMaterialIds(course.offeringId, user),
      readActivities(course.offeringId, user),
      manage ? readStudents(course.offeringId) : Promise.resolve([]),
      readAttendance(course.offeringId, user),
      readForum(course.offeringId, user),
    ]);
    const visibleMaterials = materials.map(material => ({ ...material, completed: completed.has(material.id) }));
    const totalTasks = visibleMaterials.length + activities.length;
    const doneTasks = visibleMaterials.filter(material => material.completed).length
      + activities.filter(activity => activity.submission).length;
    const enrollment = course.enrollment || {};
    return {
      ...course,
      grade: numberValue(attr(enrollment, 'academic-score')),
      attendance: numberValue(attr(enrollment, 'academic-attendance-rate'), 100),
      progress: totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0,
      announcements: [],
      materials: visibleMaterials,
      activities,
      students,
      attendanceRecords,
      forum,
    };
  }));
}

async function listPortfolio(username) {
  const posts = await listUserPosts({ username, viewerUsername: username, limit: 100 }).catch(() => []);
  return posts.filter(post => post.portfolioItem).map(post => ({
    id: post.id,
    title: post.portfolioItem.title,
    summary: post.portfolioItem.summary,
    shareUrl: post.portfolioItem.shareUrl,
    activityId: post.portfolioItem.activityId,
    updatedAt: post.time,
  }));
}

async function readNotifications(user) {
  const rows = await readQuery(`
    match
      $recipient isa person, has username "${safe(usernameOf(user))}";
      $notification isa notification, has notification-id $id, has notification-text $text, has notification-type $type, has creation-timestamp $created;
      notification-delivery(recipient: $recipient, notification: $notification);
    fetch { "id": $id, "text": $text, "type": $type, "created": $created };
  `).catch(() => []);
  return rows.map(row => ({
    id: row.id,
    title: row.type === 'academic-feedback' ? 'Feedback publicado' : row.type,
    body: row.text,
    createdAt: row.created,
    read: false,
  })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

// Self-healing: create missing academic-teaching-assignment for professor
// Bridges institution-professor-subject → academic-teaching-assignment for legacy/out-of-order data
export async function ensureTeachingAssignments(user) {
  if (roleOf(user) !== 'professor') return;
  const username = safe(usernameOf(user));
  const expectedOfferings = await readQuery(`
    match
      $professor isa person, has username "${username}";
      $subject isa institution-subject;
      $semester isa institution-semester;
      institution-professor-subject(professor: $professor, subject: $subject, semester: $semester),
        has institution-status "approved";
      $offering isa academic-course-offering;
      academic-offering-subject-link(offering: $offering, subject: $subject);
      institution-class-group-link(semester: $semester, class-group: $class_group);
      academic-offering-class-group-link(offering: $offering, class-group: $class_group);
    fetch { "offering": { $offering.* } };
  `).catch(() => []);

  for (const row of expectedOfferings) {
    const offeringId = attr(attrs(row, 'offering'), 'academic-offering-id');
    if (!offeringId) continue;
    const exists = await readQuery(`
      match
        $professor isa person, has username "${username}";
        $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
        academic-teaching-assignment(teacher: $professor, offering: $offering);
      fetch { "offering": { $offering.* } };
    `).catch(() => []);
    if (!exists.length) {
      await writeQuery(`
        match
          $professor isa person, has username "${username}";
          $offering isa academic-course-offering, has academic-offering-id "${safe(offeringId)}";
        insert
          $ta isa academic-teaching-assignment, links (teacher: $professor, offering: $offering),
            has academic-role "professor",
            has academic-status "active";
      `).catch(() => null);
    }
  }
}

export async function getAvaState(user, universityId = '') {
  if (roleOf(user) === 'professor') await ensureTeachingAssignments(user);
  const courses = await buildCourses(user, universityId);
  const notifications = await readNotifications(user);
  const activities = courses.flatMap(course => course.activities);
  const pending = activities.filter(activity => ['pending', 'late'].includes(activity.status)).length;
  const progress = courses.length ? Math.round(courses.reduce((sum, course) => sum + course.progress, 0) / courses.length) : 0;
  const grades = courses.map(course => ({
    courseId: course.id,
    courseName: course.name,
    grade: course.grade,
    attendance: course.attendance,
    progress: course.progress,
  }));
  const teacher = roleOf(user) === 'professor' || isAcademicManager(user);
  return {
    institution: courses[0]?.institution || null,
    student: { username: usernameOf(user), displayName: displayNameOf(user) },
    summary: {
      pendingActivities: pending,
      averageProgress: progress,
      xp: 0,
      level: 1,
      notifications: notifications.length,
      nextActivity: activities.filter(item => item.status === 'pending').sort((a, b) => new Date(a.due) - new Date(b.due))[0] || null,
    },
    studentDashboard: {
      grades,
      average: grades.length ? (grades.reduce((sum, item) => sum + item.grade, 0) / grades.length).toFixed(1) : '0.0',
      attendanceAverage: grades.length ? Math.round(grades.reduce((sum, item) => sum + item.attendance, 0) / grades.length) : 0,
      calendar: activities.map(activity => ({ ...activity, courseName: courses.find(course => course.activities.includes(activity))?.name || '' })),
    },
    teacherDashboard: teacher ? {
      totalClasses: courses.length,
      totalStudents: courses.reduce((sum, course) => sum + course.students.length, 0),
      pendingCorrections: (await listTeacherSubmissions(user)).filter(item => item.status !== 'graded').length,
      calendar: activities,
    } : null,
    courses,
    notifications,
    portfolio: await listPortfolio(usernameOf(user)),
    resume: null,
  };
}

export async function setMaterialCompletion(user, materialId, completed) {
  const username = safe(usernameOf(user));
  const material = safe(materialId);
  const existing = await readQuery(`
    match
      $student isa person, has username "${username}";
      $material isa academic-material, has academic-material-id "${material}";
      $offering isa academic-course-offering;
      academic-offering-material(offering: $offering, material: $material);
      academic-enrollment(student: $student, offering: $offering);
      try { $completion isa academic-material-completion, links (material: $material, student: $student); };
    fetch { "material": { $material.* }, "completion": { $completion.* } };
  `);
  if (!existing.length) return null;
  const hasCompletion = Boolean(attr(attrs(existing[0], 'completion'), 'academic-status'));
  if (completed && !hasCompletion) {
    await writeQuery(`
      match
        $student isa person, has username "${username}";
        $material isa academic-material, has academic-material-id "${material}";
      insert
        $completion isa academic-material-completion, links (material: $material, student: $student),
          has academic-status "completed",
          has academic-datetime ${typeqlDatetime()};
    `);
  } else if (!completed && hasCompletion) {
    await writeQuery(`
      match
        $student isa person, has username "${username}";
        $material isa academic-material, has academic-material-id "${material}";
        $completion isa academic-material-completion, links (material: $material, student: $student);
      delete $completion;
    `);
  }
  return getAvaState(user);
}

export async function submitActivity(user, activityId, payload) {
  const submissionId = `submission-${uuid()}`;
  const optional = [
    payload.documentName && `has academic-document-name "${safe(payload.documentName)}"`,
    payload.documentStorage && `has academic-document-storage "${safe(payload.documentStorage)}"`,
    payload.documentPath && `has academic-document-path "${safe(payload.documentPath)}"`,
    payload.attachmentKind && `has academic-external-kind "${safe(payload.attachmentKind)}"`,
    payload.attachmentLabel && `has academic-external-label "${safe(payload.attachmentLabel)}"`,
  ].filter(Boolean);
  const url = payload.documentUrl || payload.attachmentUrl || '';
  if (url) optional.push(`has academic-url "${safe(url)}"`);
  const found = await readQuery(`
    match
      $student isa person, has username "${safe(usernameOf(user))}";
      $activity isa academic-activity, has academic-activity-id "${safe(activityId)}";
      $offering isa academic-course-offering;
      academic-offering-activity(offering: $offering, activity: $activity);
      academic-enrollment(student: $student, offering: $offering);
    fetch { "activity": { $activity.* } };
  `);
  if (!found.length) return null;
  await writeQuery(`
    match
      $student isa person, has username "${safe(usernameOf(user))}";
      $activity isa academic-activity, has academic-activity-id "${safe(activityId)}";
    insert
      $submission isa academic-submission,
        has academic-submission-id "${submissionId}",
        has academic-content "${safe(payload.content)}",
        has academic-status "submitted",
        has academic-datetime ${typeqlDatetime()}${optional.length ? `,\n        ${optional.join(',\n        ')}` : ''};
      $link isa academic-activity-submission, links (activity: $activity, submission: $submission, student: $student);
  `);
  return getAvaState(user);
}

export async function publishSubmissionToPortfolio(user, submissionId, payload = {}) {
  const rows = await readQuery(`
    match
      $student isa person, has username "${safe(usernameOf(user))}";
      $submission isa academic-submission, has academic-submission-id "${safe(submissionId)}";
      $activity isa academic-activity, has academic-title $activity_title;
      academic-activity-submission(activity: $activity, submission: $submission, student: $student);
    fetch { "submission": { $submission.* }, "activity_title": $activity_title };
  `);
  if (!rows.length) return null;
  const submission = mapSubmission(attrs(rows[0], 'submission'));
  const title = payload.title || rows[0].activity_title || 'Entrega academica';
  const summary = payload.summary || submission.content.slice(0, 360);
  const slug = await generatePortfolioSlug(usernameOf(user), title);
  const shareUrl = `/portfolio/${usernameOf(user)}/${slug}`;
  const post = await createPost({
    authorUsername: usernameOf(user),
    postType: 'text-post',
    content: `Novo case academico publicado: ${title}\n\n${summary}\n\n${shareUrl} #PortfolioAcademico`,
    media: null,
    communityId: null,
  });
  await annotatePortfolioPost({
    postId: post.id,
    metadata: {
      portfolioId: submissionId,
      title,
      summary,
      slug,
      shareUrl,
      documentUrl: submission.documentUrl,
      documentName: submission.documentName,
      documentStorage: submission.documentStorage,
    },
  });
  await writeQuery(`
    match $submission isa academic-submission, has academic-submission-id "${safe(submissionId)}";
    update $submission has academic-share-url "${safe(shareUrl)}";
  `);
  return getAvaState(user);
}

export async function createForumPost(user, courseId, content) {
  const postId = `forum-${uuid()}`;
  const rows = await readQuery(`
    match
      $offering isa academic-course-offering;
      $course isa academic-course, has academic-course-id "${safe(courseId)}";
      $offering isa academic-course-offering, links (course: $course, institution: $institution);
      ${authorizationMatch(user)}
    fetch { "offering": { $offering.* } };
  `);
  if (!rows.length) return null;
  await writeQuery(`
    match
      $author isa person, has username "${safe(usernameOf(user))}";
      $course isa academic-course, has academic-course-id "${safe(courseId)}";
      $offering isa academic-course-offering, links (course: $course, institution: $institution);
    insert
      $post isa academic-forum-post,
        has academic-forum-post-id "${postId}",
        has academic-content "${safe(content)}",
        has academic-datetime ${typeqlDatetime()};
      $forum_link isa academic-offering-forum, links (offering: $offering, post: $post);
      $authorship isa academic-forum-authorship, links (author: $author, post: $post);
  `);
  return getAvaState(user);
}

export async function createForumComment(user, courseId, postId, content) {
  const commentId = `comment-${uuid()}`;
  const rows = await readQuery(`
    match
      $course isa academic-course, has academic-course-id "${safe(courseId)}";
      $offering isa academic-course-offering, links (course: $course, institution: $institution);
      $post isa academic-forum-post, has academic-forum-post-id "${safe(postId)}";
      academic-offering-forum(offering: $offering, post: $post);
      ${authorizationMatch(user)}
    fetch { "post": { $post.* } };
  `);
  if (!rows.length) return null;
  await writeQuery(`
    match
      $author isa person, has username "${safe(usernameOf(user))}";
      $post isa academic-forum-post, has academic-forum-post-id "${safe(postId)}";
    insert
      $comment isa academic-forum-comment,
        has academic-forum-comment-id "${commentId}",
        has academic-content "${safe(content)}",
        has academic-datetime ${typeqlDatetime()};
      $link isa academic-forum-comment-link, links (post: $post, comment: $comment, author: $author);
  `);
  return getAvaState(user);
}

async function teacherCanManage(user, courseId) {
  const rows = await readQuery(`
    match
      $course isa academic-course, has academic-course-id "${safe(courseId)}";
      $offering isa academic-course-offering, links (course: $course, institution: $institution);
      ${authorizationMatch(user)}
    fetch { "offering": { $offering.* } };
  `);
  return rows.length > 0;
}

export async function createTeacherMaterial(user, courseId, payload) {
  if (!(await teacherCanManage(user, courseId))) return null;
  const id = `mat-${uuid()}`;
  const optional = [
    payload.url && `has academic-url "${safe(payload.url)}"`,
    payload.documentName && `has academic-document-name "${safe(payload.documentName)}"`,
    payload.storage && `has academic-document-storage "${safe(payload.storage)}"`,
    payload.documentPath && `has academic-document-path "${safe(payload.documentPath)}"`,
    payload.duration && `has academic-duration "${safe(payload.duration)}"`,
  ].filter(Boolean);
  await writeQuery(`
    match
      $course isa academic-course, has academic-course-id "${safe(courseId)}";
      $offering isa academic-course-offering, links (course: $course, institution: $institution);
    insert
      $material isa academic-material,
        has academic-material-id "${id}",
        has academic-title "${safe(payload.title)}",
        has academic-material-type "${safe(payload.type || 'pdf')}",
        has academic-status "published",
        has academic-required ${payload.required !== false}${optional.length ? `,\n        ${optional.join(',\n        ')}` : ''};
      $link isa academic-offering-material, links (offering: $offering, material: $material);
  `);
  return getAvaState(user);
}

async function generateCourseId(title) {
  const base = slugify(title);
  let candidate = base;
  let suffix = 2;
  while (true) {
    const rows = await readQuery(`
      match $course isa academic-course, has academic-course-id "${safe(candidate)}";
      fetch { "course": { $course.* } };
    `);
    if (!rows.length) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function deleteTeacherMaterial(user, materialId) {
  const rows = await readQuery(`
    match
      $material isa academic-material, has academic-material-id "${safe(materialId)}";
      $offering isa academic-course-offering;
      $link isa academic-offering-material, links (offering: $offering, material: $material);
      ${authorizationMatch(user)}
    fetch { "material": { $material.* } };
  `);
  if (!rows.length) return null;
  const material = attrs(rows[0], 'material');
  await deleteDocumentObject({
    storage: attr(material, 'academic-document-storage'),
    path: attr(material, 'academic-document-path'),
  });
  await writeQuery(`
    match
      $material isa academic-material, has academic-material-id "${safe(materialId)}";
      $completion isa academic-material-completion, links (material: $material, student: $student);
    delete $completion;
  `).catch(() => null);
  await writeQuery(`
    match
      $material isa academic-material, has academic-material-id "${safe(materialId)}";
      $link isa academic-offering-material, links (material: $material, offering: $offering);
    delete $link; $material;
  `);
  return getAvaState(user);
}

export async function createAcademicCourse(user, payload) {
  if (!isAcademicManager(user)) return null;
  const institutionCode = payload.institutionCode || 'unigran';
  const existingCode = await readQuery(`
    match $course isa academic-course, has academic-code "${safe(payload.code)}";
    fetch { "course": { $course.* } };
  `);
  if (existingCode.length) {
    const err = new Error('Ja existe uma disciplina com este codigo');
    err.statusCode = 409;
    throw err;
  }
  const institution = await readQuery(`
    match $institution isa educational-institute, has academic-institution-code "${safe(institutionCode)}";
    fetch { "institution": { $institution.* } };
  `);
  if (!institution.length) {
    const err = new Error('Instituicao academica nao encontrada');
    err.statusCode = 404;
    throw err;
  }
  const id = await generateCourseId(payload.title);
  const offeringId = `${id}-${slugify(payload.period)}`;
  const tags = (payload.tags || [])
    .map(tag => String(tag || '').trim())
    .filter(Boolean)
    .map(tag => `has academic-tag "${safe(tag)}"`);
  await writeQuery(`
    match $institution isa educational-institute, has academic-institution-code "${safe(institutionCode)}";
    insert
      $course isa academic-course,
        has academic-course-id "${id}",
        has academic-code "${safe(payload.code)}",
        has academic-title "${safe(payload.title)}",
        has academic-description "${safe(payload.description || '')}",
        has academic-color "${safe(payload.color || '#2563eb')}"${tags.length ? `,\n        ${tags.join(',\n        ')}` : ''};
      $offering isa academic-course-offering, links (institution: $institution, course: $course),
        has academic-offering-id "${offeringId}",
        has academic-period "${safe(payload.period)}",
        has academic-schedule "${safe(payload.schedule)}",
        has academic-room "${safe(payload.room)}",
        has academic-status "active";
  `);
  return getAvaState(user);
}

export async function enrollStudentInCourse(user, courseId, payload) {
  if (!isAcademicManager(user) || !(await teacherCanManage(user, courseId))) return null;
  const exists = await readQuery(`
    match
      $student isa person, has username "${safe(payload.username)}";
      $course isa academic-course, has academic-course-id "${safe(courseId)}";
      $offering isa academic-course-offering, links (course: $course, institution: $institution);
      try { $previous isa academic-enrollment, links (student: $student, offering: $offering); };
    fetch { "student": { $student.* }, "offering": { $offering.* }, "previous": { $previous.* } };
  `);
  if (!exists.length) return null;
  if (attr(attrs(exists[0], 'previous'), 'academic-enrollment-id')) return getAvaState(user);
  await writeQuery(`
    match
      $student isa person, has username "${safe(payload.username)}";
      $course isa academic-course, has academic-course-id "${safe(courseId)}";
      $offering isa academic-course-offering, links (course: $course, institution: $institution);
    insert
      $enrollment isa academic-enrollment, links (student: $student, offering: $offering),
        has academic-enrollment-id "enrollment-${uuid()}",
        has academic-registration "${safe(payload.registration)}",
        has academic-status "active",
        has academic-attendance-rate 100.0,
        has academic-risk "Regular",
        has academic-datetime ${typeqlDatetime()};
  `);
  return getAvaState(user);
}

export async function assignTeacherToCourse(user, courseId, payload) {
  if (!isAcademicManager(user) || !(await teacherCanManage(user, courseId))) return null;
  const exists = await readQuery(`
    match
      $teacher isa person, has username "${safe(payload.username)}";
      $course isa academic-course, has academic-course-id "${safe(courseId)}";
    fetch { "teacher": { $teacher.* } };
  `);
  if (!exists.length) return null;
  const assignments = await readQuery(`
    match
      $course isa academic-course, has academic-course-id "${safe(courseId)}";
      $offering isa academic-course-offering, links (course: $course, institution: $institution);
      $assignment isa academic-teaching-assignment, links (offering: $offering, teacher: $current_teacher);
    fetch { "assignment": { $assignment.* } };
  `);
  if (assignments.length) {
    await writeQuery(`
      match
        $course isa academic-course, has academic-course-id "${safe(courseId)}";
        $offering isa academic-course-offering, links (course: $course, institution: $institution);
        $assignment isa academic-teaching-assignment, links (offering: $offering, teacher: $current_teacher);
      delete $assignment;
    `);
  }
  await writeQuery(`
    match
      $teacher isa person, has username "${safe(payload.username)}";
      $course isa academic-course, has academic-course-id "${safe(courseId)}";
      $offering isa academic-course-offering, links (course: $course, institution: $institution);
    insert
      $assignment isa academic-teaching-assignment, links (teacher: $teacher, offering: $offering),
        has academic-role "professor",
        has academic-status "active";
  `);
  return getAvaState(user);
}

export async function createTeacherActivity(user, courseId, payload) {
  if (!(await teacherCanManage(user, courseId))) return null;
  const id = `act-${uuid()}`;
  await writeQuery(`
    match
      $course isa academic-course, has academic-course-id "${safe(courseId)}";
      $offering isa academic-course-offering, links (course: $course, institution: $institution);
    insert
      $activity isa academic-activity,
        has academic-activity-id "${id}",
        has academic-title "${safe(payload.title)}",
        has academic-description "${safe(payload.description || '')}",
        has academic-datetime ${typeqlDatetime(payload.due)},
        has academic-points ${Number(payload.points || 10)},
        has academic-xp ${Number(payload.xp || 120)};
      $link isa academic-offering-activity, links (offering: $offering, activity: $activity);
  `);
  return getAvaState(user);
}

export async function updateTeacherActivity(user, activityId, payload) {
  const rows = await readQuery(`
    match
      $activity isa academic-activity, has academic-activity-id "${safe(activityId)}";
      $offering isa academic-course-offering;
      academic-offering-activity(offering: $offering, activity: $activity);
      ${authorizationMatch(user)}
    fetch { "activity": { $activity.* } };
  `);
  if (!rows.length) return null;
  await writeQuery(`
    match $activity isa academic-activity, has academic-activity-id "${safe(activityId)}";
    update
      $activity has academic-title "${safe(payload.title)}";
      $activity has academic-description "${safe(payload.description || '')}";
      $activity has academic-datetime ${typeqlDatetime(payload.due)};
      $activity has academic-points ${Number(payload.points || 10)};
      $activity has academic-xp ${Number(payload.xp || 120)};
  `);
  return getAvaState(user);
}

export async function deleteTeacherActivity(user, activityId) {
  const rows = await readQuery(`
    match
      $activity isa academic-activity, has academic-activity-id "${safe(activityId)}";
      $offering isa academic-course-offering;
      academic-offering-activity(offering: $offering, activity: $activity);
      ${authorizationMatch(user)}
      try { academic-activity-submission(activity: $activity, submission: $submission, student: $student); };
    fetch { "activity": { $activity.* }, "submission": { $submission.* } };
  `);
  if (!rows.length) return { state: null, conflict: false };
  if (rows.some(row => attr(attrs(row, 'submission'), 'academic-submission-id'))) return { state: null, conflict: true };
  await writeQuery(`
    match
      $activity isa academic-activity, has academic-activity-id "${safe(activityId)}";
      $link isa academic-offering-activity, links (activity: $activity, offering: $offering);
    delete $link; $activity;
  `);
  return { state: await getAvaState(user), conflict: false };
}

export async function saveAttendance(user, courseId, payload) {
  if (!(await teacherCanManage(user, courseId))) return null;
  const validStudents = await readQuery(`
    match
      $course isa academic-course, has academic-course-id "${safe(courseId)}";
      $offering isa academic-course-offering, links (course: $course, institution: $institution);
      $student isa person, has username $username;
      academic-enrollment(student: $student, offering: $offering);
    fetch { "username": $username };
  `);
  const roster = new Set(validStudents.map(row => row.username));
  if (payload.entries.some(entry => !roster.has(entry.studentId))) return null;

  const previous = await readQuery(`
    match
      $course isa academic-course, has academic-course-id "${safe(courseId)}";
      $offering isa academic-course-offering, links (course: $course, institution: $institution);
      $session isa academic-attendance-session, has academic-date ${payload.date}, has academic-attendance-session-id $id;
      academic-offering-attendance(offering: $offering, session: $session);
    fetch { "id": $id };
  `);
  const sessionId = previous[0]?.id || `attendance-${uuid()}`;
  if (previous.length) {
    await writeQuery(`
      match $session isa academic-attendance-session, has academic-attendance-session-id "${safe(sessionId)}";
      update $session has academic-title "${safe(payload.topic)}";
    `);
  } else {
    await writeQuery(`
      match
        $course isa academic-course, has academic-course-id "${safe(courseId)}";
        $offering isa academic-course-offering, links (course: $course, institution: $institution);
      insert
        $session isa academic-attendance-session,
          has academic-attendance-session-id "${sessionId}",
          has academic-date ${payload.date},
          has academic-title "${safe(payload.topic)}";
        $link isa academic-offering-attendance, links (offering: $offering, session: $session);
    `);
  }
  for (const entry of payload.entries) {
    const existing = await readQuery(`
      match
        $session isa academic-attendance-session, has academic-attendance-session-id "${sessionId}";
        $student isa person, has username "${safe(entry.studentId)}";
        $entry isa academic-attendance-entry, links (session: $session, student: $student);
      fetch { "entry": { $entry.* } };
    `);
    if (existing.length) {
      await writeQuery(`
        match
          $session isa academic-attendance-session, has academic-attendance-session-id "${sessionId}";
          $student isa person, has username "${safe(entry.studentId)}";
          $entry isa academic-attendance-entry, links (session: $session, student: $student);
        update
          $entry has academic-status "${safe(entry.status)}";
          $entry has academic-justification "${safe(entry.justification || '')}";
      `);
    } else {
      await writeQuery(`
        match
          $session isa academic-attendance-session, has academic-attendance-session-id "${sessionId}";
          $student isa person, has username "${safe(entry.studentId)}";
        insert
        $entry isa academic-attendance-entry, links (session: $session, student: $student),
          has academic-status "${safe(entry.status)}",
          has academic-justification "${safe(entry.justification || '')}";
      `);
    }
    const attendanceRows = await readQuery(`
      match
        $course isa academic-course, has academic-course-id "${safe(courseId)}";
        $offering isa academic-course-offering, links (course: $course, institution: $institution);
        $session isa academic-attendance-session;
        academic-offering-attendance(offering: $offering, session: $session);
        $student isa person, has username "${safe(entry.studentId)}";
        $attendance isa academic-attendance-entry, links (session: $session, student: $student), has academic-status $status;
      fetch { "status": $status };
    `);
    const attended = attendanceRows.filter(row => ['present', 'late', 'justified'].includes(row.status)).length;
    const rate = attendanceRows.length ? (attended / attendanceRows.length) * 100 : 100;
    await writeQuery(`
      match
        $course isa academic-course, has academic-course-id "${safe(courseId)}";
        $offering isa academic-course-offering, links (course: $course, institution: $institution);
        $student isa person, has username "${safe(entry.studentId)}";
        $enrollment isa academic-enrollment, links (student: $student, offering: $offering);
      update $enrollment has academic-attendance-rate ${rate.toFixed(2)};
    `);
  }
  return getAvaState(user);
}

export async function listTeacherSubmissions(user) {
  const rows = await readQuery(`
    match
      $offering isa academic-course-offering;
      ${authorizationMatch(user)}
      $course isa academic-course, has academic-title $course_name;
      $offering isa academic-course-offering, links (course: $course, institution: $institution);
      $activity isa academic-activity, has academic-title $activity_title;
      academic-offering-activity(offering: $offering, activity: $activity);
      $submission isa academic-submission;
      $student isa person, has username $username, has name $author;
      academic-activity-submission(activity: $activity, submission: $submission, student: $student);
    fetch {
      "submission": { $submission.* },
      "course_name": $course_name,
      "activity_title": $activity_title,
      "username": $username,
      "author": $author
    };
  `);
  return rows.map(row => mapSubmission(attrs(row, 'submission'), {
    courseName: row.course_name,
    activityTitle: row.activity_title,
    username: row.username,
    author: row.author,
  })).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function gradeSubmission(user, submissionId, payload) {
  const submissions = await listTeacherSubmissions(user);
  const submission = submissions.find(item => item.id === submissionId);
  if (!submission) return null;
  await writeQuery(`
    match $submission isa academic-submission, has academic-submission-id "${safe(submissionId)}";
    update
      $submission has academic-status "graded";
      $submission has academic-score ${Number(payload.score)};
      $submission has academic-feedback "${safe(payload.feedback)}";
  `);
  await writeQuery(`
    match $recipient isa person, has username "${safe(submission.username)}";
    insert
      $notification isa notification,
        has notification-id "academic-feedback-${uuid()}",
        has notification-text "${safe(`${submission.activityTitle}: nota ${Number(payload.score).toFixed(1)}. ${payload.feedback}`)}",
        has notification-type "academic-feedback",
        has creation-timestamp ${typeqlDatetime()};
      $delivery isa notification-delivery, links (recipient: $recipient, notification: $notification);
  `).catch(() => null);
  return listTeacherSubmissions(user);
}

export async function getAvaPowerBiSnapshot() {
  const systemUser = { role: 'super_admin', username: '__analytics__' };
  const courses = await buildCourses(systemUser);
  const submissions = await listTeacherSubmissions(systemUser);
  const completedRows = await readQuery(`
    match $completion isa academic-material-completion;
    fetch { "completion": { $completion.* } };
  `);
  const enrollmentRows = await readQuery(`
    match $enrollment isa academic-enrollment;
    fetch { "enrollment": { $enrollment.* } };
  `);
  const published = submissions.filter(item => item.portfolioShareUrl);
  return {
    generatedAt: new Date().toISOString(),
    source: 'TypeDB academic relations',
    dimensions: {
      students: enrollmentRows.length,
      courses: courses.length,
      activities: courses.reduce((sum, course) => sum + course.activities.length, 0),
      materials: courses.reduce((sum, course) => sum + course.materials.length, 0),
    },
    kpis: {
      submissions: submissions.length,
      portfolioItems: published.length,
      resumes: 0,
      completedMaterials: completedRows.length,
      averageProgress: 0,
      publishRate: submissions.length ? Math.round((published.length / submissions.length) * 100) : 0,
    },
    byCourse: courses.map(course => ({
      id: course.id,
      name: course.name,
      code: course.code,
      period: course.period,
      activities: course.activities.length,
      materials: course.materials.length,
      submissions: submissions.filter(item => item.courseName === course.name).length,
      portfolioItems: published.filter(item => item.courseName === course.name).length,
    })),
    portfolio: published.slice(0, 12),
    submissions: submissions.slice(0, 12),
  };
}
