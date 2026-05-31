import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { readQuery, typeqlDatetime, typeqlLiteral, writeQuery } from '../db/typedb.js';

const router = Router();

const PublicKeySchema = z.object({
  publicKey: z.string().min(40).max(12000),
});

const DeviceKeySchema = z.object({
  deviceId: z.string().min(8).max(160),
  deviceName: z.string().min(1).max(120).optional(),
  publicKey: z.string().min(40).max(12000),
});

router.put('/public-key', auth, async (req, res) => {
  const parsed = PublicKeySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Chave invalida' });

  try {
    await writeQuery(`
      match
        $u isa person, has username "${typeqlLiteral(req.user.username)}";
      update
        $u has crypto-public-key "${typeqlLiteral(parsed.data.publicKey)}";
    `);
    res.json({ saved: true });
  } catch (err) {
    console.error('[crypto public-key PUT]', err);
    res.status(500).json({ error: 'Erro ao salvar chave' });
  }
});

router.post('/public-keys', auth, async (req, res) => {
  const usernames = [...new Set((req.body?.usernames || []).map(item => String(item).replace(/^@/, '').trim()).filter(Boolean))];
  if (!usernames.length) return res.json({ keys: {} });

  try {
    const rows = await Promise.all(usernames.map(username => readQuery(`
      match
        $u isa person, has username $username, has crypto-public-key $key;
        $username == "${typeqlLiteral(username)}";
      fetch {
        "username": $username,
        "key": $key
      };
    `).catch(() => [])));

    const keys = {};
    for (const rowList of rows) {
      const row = rowList[0];
      if (row?.username && row?.key) keys[row.username] = row.key;
    }
    res.json({ keys });
  } catch (err) {
    console.error('[crypto public-keys POST]', err);
    res.status(500).json({ error: 'Erro ao buscar chaves' });
  }
});

router.put('/devices/current', auth, async (req, res) => {
  const parsed = DeviceKeySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Aparelho ou chave invalida' });

  try {
    const deviceId = typeqlLiteral(parsed.data.deviceId);
    const name = typeqlLiteral(parsed.data.deviceName || 'Navegador');
    const key = typeqlLiteral(parsed.data.publicKey);
    const now = typeqlDatetime();

    // Busca sem try{} opcional para evitar resultado falso-negativo
    const existing = await readQuery(`
      match
        $owner isa person, has username "${typeqlLiteral(req.user.username)}";
        $device isa crypto-device, has crypto-device-id "${deviceId}";
        crypto-device-owner(owner: $owner, device: $device);
      fetch { "device_id": $device_id };
    `).catch(() => []);

    if (existing.length) {
      // Verifica revogação separadamente
      const revokedRows = await readQuery(`
        match
          $owner isa person, has username "${typeqlLiteral(req.user.username)}";
          $device isa crypto-device, has crypto-device-id "${deviceId}", has crypto-device-revoked $revoked;
          crypto-device-owner(owner: $owner, device: $device);
        fetch { "revoked": $revoked };
      `).catch(() => []);

      const isRevoked = revokedRows.length > 0 &&
        (revokedRows[0].revoked === true || String(revokedRows[0].revoked).toLowerCase() === 'true');

      if (isRevoked) {
        return res.status(403).json({ error: 'Aparelho removido' });
      }

      await writeQuery(`
        match
          $owner isa person, has username "${typeqlLiteral(req.user.username)}";
          $device isa crypto-device, has crypto-device-id "${deviceId}";
          crypto-device-owner(owner: $owner, device: $device);
        update
          $device has crypto-device-name "${name}";
          $device has crypto-device-public-key "${key}";
          $device has crypto-device-last-seen ${now};
      `);
    } else {
      // Tenta inserir; se falhar por constraint (race condition), tenta update
      try {
        await writeQuery(`
          match
            $owner isa person, has username "${typeqlLiteral(req.user.username)}";
          insert
            $device isa crypto-device,
              has crypto-device-id "${deviceId}",
              has crypto-device-name "${name}",
              has crypto-device-public-key "${key}",
              has crypto-device-created-at ${now},
              has crypto-device-last-seen ${now},
              has crypto-device-revoked false;
            crypto-device-owner(owner: $owner, device: $device);
        `);
      } catch (insertErr) {
        if (String(insertErr?.message || '').includes('unique') || String(insertErr?.message || '').includes('CNT9')) {
          // Já existe (race condition) — faz update
          await writeQuery(`
            match
              $owner isa person, has username "${typeqlLiteral(req.user.username)}";
              $device isa crypto-device, has crypto-device-id "${deviceId}";
              crypto-device-owner(owner: $owner, device: $device);
            update
              $device has crypto-device-name "${name}";
              $device has crypto-device-public-key "${key}";
              $device has crypto-device-last-seen ${now};
          `);
        } else {
          throw insertErr;
        }
      }
    }

    res.json({ saved: true, deviceId: parsed.data.deviceId });
  } catch (err) {
    console.error('[crypto device PUT]', err);
    res.status(500).json({ error: 'Erro ao salvar aparelho' });
  }
});

router.post('/device-keys', auth, async (req, res) => {
  const usernames = [...new Set((req.body?.usernames || []).map(item => String(item).replace(/^@/, '').trim()).filter(Boolean))];
  if (!usernames.length) return res.json({ devices: {} });

  try {
    const rows = await Promise.all(usernames.map(username => readQuery(`
      match
        $owner isa person, has username "${typeqlLiteral(username)}";
        $device isa crypto-device,
          has crypto-device-id $device_id,
          has crypto-device-public-key $key;
        crypto-device-owner(owner: $owner, device: $device);
        try { $device has crypto-device-name $name; };
        try { $device has crypto-device-revoked $revoked; };
      fetch {
        "device_id": $device_id,
        "key": $key,
        "name": $name,
        "revoked": $revoked
      };
    `).catch(() => [])));

    const devices = {};
    usernames.forEach((username, index) => {
      devices[username] = rows[index]
        .filter(device => device.revoked !== true && String(device.revoked).toLowerCase() !== 'true')
        .map(device => ({ id: device.device_id, publicKey: device.key, name: device.name || 'Aparelho' }));
    });
    res.json({ devices });
  } catch (err) {
    console.error('[crypto device keys POST]', err);
    res.status(500).json({ error: 'Erro ao buscar aparelhos' });
  }
});

router.get('/devices', auth, async (req, res) => {
  try {
    const devices = await readQuery(`
      match
        $owner isa person, has username "${typeqlLiteral(req.user.username)}";
        $device isa crypto-device, has crypto-device-id $device_id;
        crypto-device-owner(owner: $owner, device: $device);
        try { $device has crypto-device-name $name; };
        try { $device has crypto-device-last-seen $last_seen; };
        try { $device has crypto-device-revoked $revoked; };
      fetch {
        "device_id": $device_id,
        "name": $name,
        "last_seen": $last_seen,
        "revoked": $revoked
      };
    `);
    res.json({ devices });
  } catch (err) {
    console.error('[crypto devices GET]', err);
    res.status(500).json({ error: 'Erro ao listar aparelhos' });
  }
});

router.delete('/devices/:deviceId', auth, async (req, res) => {
  try {
    await writeQuery(`
      match
        $owner isa person, has username "${typeqlLiteral(req.user.username)}";
        $device isa crypto-device, has crypto-device-id "${typeqlLiteral(req.params.deviceId)}";
        crypto-device-owner(owner: $owner, device: $device);
      update
        $device has crypto-device-revoked true;
    `);
    res.json({ revoked: true });
  } catch (err) {
    console.error('[crypto device DELETE]', err);
    res.status(500).json({ error: 'Erro ao remover aparelho' });
  }
});

export default router;
