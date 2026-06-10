import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Smile } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { UNICODE_EMOJI_CATEGORIES } from '../../data/unicodeEmojiData';

const EMOJI_CATEGORIES = [
  {
    label: '😀',
    name: 'Rostos',
    keywords: 'face sorriso rir emoção pessoa',
    emojis: '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 🫠 😉 😊 😇 🥰 😍 🤩 😘 😗 ☺️ 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🫢 🫣 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 🫥 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 😵‍💫 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 🫤 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👺 👻 👽 👾 🤖'.split(' '),
  },
  {
    label: '👋',
    name: 'Gestos e corpo',
    keywords: 'mão gesto corpo pessoa dedo coração',
    emojis: '👋 🤚 🖐️ ✋ 🖖 🫱 🫲 🫳 🫴 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 🫵 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦵 🦿 🦶 👂 🦻 👃 🫀 🫁 🧠 🦷 🦴 👀 👁️ 👅 👄 🫦 👶 🧒 👦 👧 🧑 👱 👨 🧔 👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷'.split(' '),
  },
  {
    label: '❤️',
    name: 'Símbolos',
    keywords: 'coração estrela fogo sinal símbolo amor',
    emojis: '❤️ 🩷 🧡 💛 💚 💙 🩵 💜 🤎 🖤 🩶 🤍 💔 ❤️‍🔥 ❤️‍🩹 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ 🉑 ☢️ ☣️ 📴 📳 🈶 🈚 🈸 🈺 🈷️ ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🈴 🈵 🈹 🈲 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕ 🛑 ⛔ 📛 🚫 💯 💢 ♨️ 🚷 🚯 🚳 🚱 🔞 📵 🚭 ❗ ❕ ❓ ❔ ‼️ ⁉️ 🔅 🔆 〽️ ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ 🈯 💹 ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 💤 🏧 🚾 ♿ 🅿️ 🛗 🈳 🈂️ 🛂 🛃 🛄 🛅'.split(' '),
  },
  {
    label: '✨',
    name: 'Destaques',
    keywords: 'brilho festa conquista foguete faculdade estudo',
    emojis: '✨ ⭐ 🌟 💫 ⚡ 🔥 💥 🎉 🎊 🎈 🎁 🎀 🪄 🪩 🏆 🥇 🥈 🥉 🏅 🎖️ 🏵️ 🎗️ 👑 💎 🚀 🛰️ 💡 🔎 🔬 🧪 🧬 📚 📖 📝 🎓 🧑‍🎓 👨‍🎓 👩‍🎓 🏫 🏛️ 💻 🖥️ ⌨️ 🖱️ 🧠 📈 📊 ✅ ☑️'.split(' '),
  },
  {
    label: '🐶',
    name: 'Animais e natureza',
    keywords: 'animal natureza planta clima',
    emojis: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐽 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🐣 🐥 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🫎 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🪰 🪲 🪳 🦟 🦗 🕷️ 🕸️ 🦂 🐢 🐍 🦎 🐊 🦕 🦖 🐙 🦑 🦐 🦞 🦀 🪼 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🦭 🐊 🐅 🐆 🦓 🦍 🦧 🦣 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🦬 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🦮 🐕‍🦺 🐈 🐈‍⬛ 🪽 🪶 🐓 🦃 🦤 🦚 🦜 🦢 🦩 🕊️ 🐇 🦝 🦨 🦡 🦫 🦦 🦥 🐁 🐀 🐿️ 🦔'.split(' '),
  },
  {
    label: '🍕',
    name: 'Comida e bebida',
    keywords: 'comida bebida café almoço pizza',
    emojis: '🍏 🍎 🍐 🍊 🍋 🍋‍🟩 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🫒 🥑 🍆 🥔 🥕 🌽 🌶️ 🫑 🥒 🥬 🥦 🧄 🧅 🍄 🥜 🫘 🌰 🫚 🫛 🍞 🥐 🥖 🫓 🥨 🥯 🥞 🧇 🧀 🍖 🍗 🥩 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🫔 🥙 🧆 🥚 🍳 🥘 🍲 🫕 🥣 🥗 🍿 🧈 🧂 🥫 🍱 🍘 🍙 🍚 🍛 🍜 🍝 🍠 🍢 🍣 🍤 🍥 🥮 🍡 🥟 🥠 🥡 🦪 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🥧 🍫 🍬 🍭 🍮 🍯 🍼 🥛 ☕ 🫖 🍵 🍶 🍾 🍷 🍸 🍹 🍺 🍻 🥂 🥃 🫗 🥤 🧋 🧃 🧉 🧊 🥢 🍽️ 🍴 🥄 🔪 🫙 🏺'.split(' '),
  },
  {
    label: '⚽',
    name: 'Atividades',
    keywords: 'esporte jogo arte música evento',
    emojis: '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪃 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚴 🚵 🎪 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🪘 🎷 🎺 🪗 🎸 🪕 🎻 🪇 🎲 ♟️ 🎯 🎳 🎮 🎰 🧩'.split(' '),
  },
  {
    label: '🚗',
    name: 'Viagem e lugares',
    keywords: 'viagem carro lugar transporte cidade',
    emojis: '🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🏍️ 🛵 🚲 🛴 🛹 🛼 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🚁 🚀 🛸 🚢 ⛵ 🚤 🛥️ 🛳️ ⛴️ ⚓ 🛟 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ ⛺ 🛖 🏠 🏡 🏘️ 🏚️ 🏗️ 🏭 🏢 🏬 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛️ ⛪ 🕌 🕍 🛕 🕋 ⛩️ 🛤️ 🛣️'.split(' '),
  },
  {
    label: '💻',
    name: 'Objetos',
    keywords: 'objeto tecnologia estudo trabalho ferramenta',
    emojis: '⌚ 📱 📲 💻 ⌨️ 🖥️ 🖨️ 🖱️ 🖲️ 🕹️ 🗜️ 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽️ 🎞️ 📞 ☎️ 📟 📠 📺 📻 🎙️ 🎚️ 🎛️ 🧭 ⏱️ ⏲️ ⏰ 🕰️ ⌛ ⏳ 📡 🔋 🪫 🔌 💡 🔦 🕯️ 🪔 🧯 🛢️ 💸 💵 💴 💶 💷 🪙 💰 💳 🪪 💎 ⚖️ 🪜 🧰 🪛 🔧 🔨 ⚒️ 🛠️ ⛏️ 🪚 🔩 ⚙️ 🪤 🧱 ⛓️ 🧲 🔫 💣 🧨 🪓 🔪 🗡️ ⚔️ 🛡️ 🚬 ⚰️ 🪦 ⚱️ 🏺 🔮 📿 🧿 🪬 💈 ⚗️ 🔭 🔬 🕳️ 🩹 🩺 🩻 🩼 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡️ 🧹 🧺 🧻 🚽 🚰 🚿 🛁 🪒 🧽 🪣 🧴 🛎️ 🔑 🗝️ 🚪 🪑 🛋️ 🛏️ 🛌 🧸 🪆 🖼️ 🪞 🪟 🛍️ 🛒 🎁 🎈 🎏 🎀 🪄 🪅 🎊 🎉 🪩 🧧 ✉️ 📩 📨 📧 💌 📥 📤 📦 🏷️ 🪧 📪 📫 📬 📭 📮 📯 📜 📃 📄 📑 🧾 📊 📈 📉 🗒️ 🗓️ 📆 📅 🗑️ 📇 🗃️ 🗳️ 🗄️ 📋 📁 📂 🗂️ 🗞️ 📰 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🧷 🔗 📎 🖇️ 📐 📏 🧮 📌 📍 ✂️ 🖊️ 🖋️ ✒️ 🖌️ 🖍️ 📝 ✏️ 🔍 🔎 🔏 🔐 🔒 🔓'.split(' '),
  },
  {
    label: '🏳️',
    name: 'Bandeiras',
    keywords: 'bandeira país nacional',
    emojis: '🏁 🚩 🎌 🏴 🏳️ 🏳️‍🌈 🏳️‍⚧️ 🏴‍☠️ 🇧🇷 🇺🇸 🇨🇦 🇲🇽 🇦🇷 🇨🇱 🇨🇴 🇵🇪 🇺🇾 🇵🇾 🇧🇴 🇪🇨 🇻🇪 🇵🇹 🇪🇸 🇫🇷 🇩🇪 🇮🇹 🇬🇧 🇮🇪 🇳🇱 🇧🇪 🇨🇭 🇦🇹 🇸🇪 🇳🇴 🇩🇰 🇫🇮 🇵🇱 🇨🇿 🇬🇷 🇹🇷 🇺🇦 🇷🇺 🇨🇳 🇯🇵 🇰🇷 🇮🇳 🇦🇺 🇳🇿 🇿🇦 🇪🇬 🇲🇦 🇳🇬 🇰🇪 🇮🇱 🇦🇪 🇸🇦'.split(' '),
  },
];

const ACTIVE_EMOJI_CATEGORIES = UNICODE_EMOJI_CATEGORIES?.length ? UNICODE_EMOJI_CATEGORIES : EMOJI_CATEGORIES;

const ALL_EMOJIS = ACTIVE_EMOJI_CATEGORIES.flatMap(category =>
  category.emojis.map(emoji => ({
    emoji,
    search: `${emoji} ${category.name} ${category.keywords}`.toLowerCase(),
  })),
);

export default function EmojiPicker({ onSelect, trigger, panelClassName = '' }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(0);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return ACTIVE_EMOJI_CATEGORIES[category].emojis;
    return ALL_EMOJIS
      .filter(item => item.search.includes(needle))
      .map(item => item.emoji)
      .slice(0, 240);
  }, [category, search]);

  const pick = (emoji) => {
    onSelect?.(emoji);
    setOpen(false);
  };

  return (
    <div ref={ref} className="emoji-picker-root">
      <div onClick={() => setOpen(value => !value)} className="emoji-picker-trigger">
        {trigger || (
          <button type="button" className="emoji-picker-default-trigger" aria-label="Emojis">
            <Smile size={18} />
          </button>
        )}
      </div>

      {open && (
        <div className={`emoji-picker-panel ${panelClassName}`}>
          <div className="emoji-picker-search">
            <Search size={15} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar emojis Unicode..."
              autoFocus
            />
          </div>

          {!search && (
            <div className="emoji-picker-tabs" aria-label="Categorias de emoji">
              {ACTIVE_EMOJI_CATEGORIES.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  className={category === index ? 'active' : ''}
                  onClick={() => setCategory(index)}
                  title={item.name}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <div className="emoji-picker-grid">
            {filtered.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                type="button"
                onClick={() => pick(emoji)}
                aria-label={`Inserir ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            {filtered.length === 0 && <p className="emoji-picker-empty">Nenhum emoji encontrado.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
