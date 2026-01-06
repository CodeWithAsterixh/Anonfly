const randomBytes = require("crypto").randomBytes;

function generateSalt(length = 32) {
  return randomBytes(length).toString("hex");
}
const salt = generateSalt(64);
console.log(salt);
