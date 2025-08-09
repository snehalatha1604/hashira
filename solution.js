const fs = require("fs");

if (process.argv.length < 3) {
  console.error("Usage: node solution.js <testcase.json>");
  process.exit(1);
}
const filePath = process.argv[2];

// parse a string value (digits + lowercase letters) in given base into BigInt
function parseBigIntFromBase(str, baseNum) {
  if (!str) return 0n;
  const base = BigInt(Number(baseNum)); // base given as string in JSON e.g. "16"
  let s = String(str).trim().toLowerCase();
  // optional: strip leading zeros
  while (s.length > 1 && s[0] === "0") s = s.slice(1);
  let value = 0n;
  for (const ch of s) {
    let digit;
    if (ch >= "0" && ch <= "9") digit = BigInt(ch.charCodeAt(0) - 48);
    else if (ch >= "a" && ch <= "z") digit = BigInt(ch.charCodeAt(0) - 97 + 10);
    else throw new Error(`Invalid character '${ch}' in value`);
    if (digit >= base)
      throw new Error(`Digit ${digit} >= base ${base} for char '${ch}'`);
    value = value * base + digit;
  }
  return value;
}

// absolute BigInt
function absBigInt(x) {
  return x < 0n ? -x : x;
}

// gcd for BigInt
function bigintGcd(a, b) {
  a = absBigInt(a);
  b = absBigInt(b);
  while (b !== 0n) {
    const r = a % b;
    a = b;
    b = r;
  }
  return a;
}

// ---------- Core: compute c = P(0) using Lagrange basis ----------
// points: array of {x: BigInt, y: BigInt}
function computeConstantC(points) {
  const m = points.length;
  // total = totalNum / totalDen (reduced after each addition)
  let totalNum = 0n;
  let totalDen = 1n;

  for (let i = 0; i < m; i++) {
    const xi = points[i].x;
    const yi = points[i].y;

    // numerator_i = product_{j != i} (-x_j)
    // denominator_i = product_{j != i} (xi - xj)
    let numer = 1n;
    let denom = 1n;
    for (let j = 0; j < m; j++) {
      if (j === i) continue;
      numer *= -points[j].x;
      denom *= xi - points[j].x;
    }

    // move sign to numerator so denom positive
    if (denom < 0n) {
      denom = -denom;
      numer = -numer;
    }

    // term = yi * numer / denom
    const termNum = yi * numer;
    const termDen = denom;

    // add to running total: totalNum/totalDen + termNum/termDen
    const newNum = totalNum * termDen + termNum * totalDen;
    const newDen = totalDen * termDen;

    // reduce by gcd
    const g = bigintGcd(newNum < 0n ? -newNum : newNum, newDen);
    totalNum = newNum / g;
    totalDen = newDen / g;
  }

  // reduce final (should already be reduced)
  const finalG = bigintGcd(totalNum < 0n ? -totalNum : totalNum, totalDen);
  totalNum /= finalG;
  totalDen /= finalG;

  return { num: totalNum, den: totalDen };
}

// ---------- Main ----------

try {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);

  if (!data.keys || typeof data.keys.k === "undefined") {
    throw new Error('JSON must contain "keys" with "k"');
  }

  const k = Number(data.keys.k);

  // collect numeric keys (exclude "keys") and sort numerically by x
  let entries = Object.keys(data)
    .filter((key) => key !== "keys")
    .map((key) => ({
      keyStr: key,
      xBig: BigInt(key),
      base: data[key].base,
      val: data[key].value,
    }));

  // sort by numeric x
  entries.sort((a, b) => (a.xBig < b.xBig ? -1 : a.xBig > b.xBig ? 1 : 0));

  // take first k entries (these provide enough points)
  if (entries.length < k) {
    throw new Error(
      `Not enough points: found ${entries.length}, required k=${k}`
    );
  }
  entries = entries.slice(0, k);

  // form points array
  const points = entries.map((e) => {
    const yBig = parseBigIntFromBase(e.val, e.base);
    return { x: e.xBig, y: yBig };
  });

  // compute c
  const { num, den } = computeConstantC(points);

  if (den === 1n) {
    console.log(num.toString());
  } else if (num % den === 0n) {
    // exact integer
    console.log((num / den).toString());
  } else {
    // print reduced fraction (if not integral)
    console.log(`${num.toString()}/${den.toString()}`);
  }
} catch (err) {
  console.error("Error:", err.message);
  process.exit(2);
}
