import fs from "node:fs";

const pem = fs.readFileSync("firmware/GridFlexEdge/isrgrootx1.pem", "utf8").trim();
const lines = pem.split(/\r?\n/);
const body = lines.map((line) => `  "${line}\\n"`).join("\n");
const out = `#ifndef GRIDFLEX_CERTS_H
#define GRIDFLEX_CERTS_H

// ISRG Root X1 (Let's Encrypt) — https://letsencrypt.org/certs/isrgrootx1.pem
static const char GRIDFLEX_ROOT_CA_PEM[] PROGMEM =
${body}
;

#endif
`;
fs.writeFileSync("firmware/GridFlexEdge/certs.h", out);
console.log("wrote certs.h", out.length);
