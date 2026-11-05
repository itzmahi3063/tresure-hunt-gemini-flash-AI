module.exports = { mnemonicToPrivateKey: async (w) => ({ publicKey: Buffer.from("pub"+w.length), secretKey: Buffer.from("sec"+w.length) }) };
