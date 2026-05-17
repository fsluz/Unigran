const store = new Map();

const EXPIRY_MS = 10 * 60 * 1000; // 10 minutos

export function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000)); // Gera um código de 6 dígitos  
}

export function saveCode(email, code) {
    store.set(email.toLowerCase(), {
        code,
        expiresAt: Date.now() + EXPIRY_MS,
    });
}

export function verifyCode(email, code) {
    const entry = store.get(email.toLowerCase());
    if (!entry) return false; // Nenhum código encontrado para este email
    if (Date.now() > entry.expiresAt) {
        store.delete(email.toLowerCase()); // Remove código expirado
        return false; // Código expirado
    }
    return entry.code == String(code); // Verifica se o código corresponde
    }
export function deleteCode(email) {
    store.delete(email.toLowerCase());

}