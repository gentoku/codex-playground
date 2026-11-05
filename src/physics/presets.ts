import {
  AU,
  G,
  barycentric,
  vec,
  type Body,
  type World,
  type V3,
} from "./nbody";
export type Experiment = {
  id: string;
  name: string;
  label: string;
  description: string;
  guide: string;
  source: string;
  scale: number;
  step: number;
  rate: number;
  world: World;
};
const body = (
  id: string,
  name: string,
  mass: number,
  radius: number,
  color: string,
  r = vec(),
  v = vec(),
): Body => ({ id, name, mass, radius, color, r, v });
/** Keplerian elements → Cartesian at the given mean anomaly, heliocentric ecliptic. */
export function fromKepler(
  a: number,
  e: number,
  inclination: number,
  node: number,
  peri: number,
  mean: number,
  mu: number,
): { r: V3; v: V3 } {
  const rad = Math.PI / 180,
    I = inclination * rad,
    O = node * rad,
    w = peri * rad,
    M = mean * rad;
  let E = M;
  for (let n = 0; n < 20; n++)
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const c = Math.cos(E),
    s = Math.sin(E),
    f = Math.sqrt(1 - e * e),
    n = Math.sqrt(mu / a ** 3);
  const rotate = (x: number, y: number): V3 =>
    vec(
      (Math.cos(O) * Math.cos(w) - Math.sin(O) * Math.sin(w) * Math.cos(I)) *
        x +
        (-Math.cos(O) * Math.sin(w) - Math.sin(O) * Math.cos(w) * Math.cos(I)) *
          y,
      (Math.sin(O) * Math.cos(w) + Math.cos(O) * Math.sin(w) * Math.cos(I)) *
        x +
        (-Math.sin(O) * Math.sin(w) + Math.cos(O) * Math.cos(w) * Math.cos(I)) *
          y,
      Math.sin(w) * Math.sin(I) * x + Math.cos(w) * Math.sin(I) * y,
    );
  return {
    r: rotate(a * (c - e), a * f * s),
    v: rotate((-a * n * s) / (1 - e * c), (a * n * f * c) / (1 - e * c)),
  };
}
const SUN = 1.98847e30;
// JPL approximate positions, 1800–2050 table, T=0 (J2000.0).
// a [AU], e, I, L, longitude of perihelion, longitude ascending node [deg].
const planets: [
  string,
  string,
  number,
  number,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
][] = [
  [
    "mercury",
    "水星",
    3.3011e23,
    2439.7e3,
    "#b5aaa2",
    0.38709927,
    0.20563593,
    7.00497902,
    252.2503235,
    77.45779628,
    48.33076593,
  ],
  [
    "venus",
    "金星",
    4.8675e24,
    6051.8e3,
    "#e5bd86",
    0.72333566,
    0.00677672,
    3.39467605,
    181.9790995,
    131.60246718,
    76.67984255,
  ],
  [
    "earth",
    "地球",
    5.97237e24,
    6371.0088e3,
    "#67b6ff",
    1.00000261,
    0.01671123,
    -0.00001531,
    100.46457166,
    102.93768193,
    0,
  ],
  [
    "mars",
    "火星",
    6.4171e23,
    3389.5e3,
    "#ec8a66",
    1.52371034,
    0.0933941,
    1.84969142,
    -4.55343205,
    -23.94362959,
    49.55953891,
  ],
  [
    "jupiter",
    "木星",
    1.8982e27,
    69911e3,
    "#d5ba9a",
    5.202887,
    0.04838624,
    1.30439695,
    34.39644051,
    14.72847983,
    100.47390909,
  ],
  [
    "saturn",
    "土星",
    5.6834e26,
    58232e3,
    "#e7d09e",
    9.53667594,
    0.05386179,
    2.48599187,
    49.95424423,
    92.59887831,
    113.66242448,
  ],
  [
    "uranus",
    "天王星",
    8.681e25,
    25362e3,
    "#92d3dd",
    19.18916464,
    0.04725744,
    0.77263783,
    313.23810451,
    170.9542763,
    74.01692503,
  ],
  [
    "neptune",
    "海王星",
    1.02413e26,
    24622e3,
    "#668fea",
    30.06992276,
    0.00859048,
    1.77004347,
    -55.12002969,
    44.96476227,
    131.78422574,
  ],
];
const solarBodies = () => [
  body("sun", "太陽", SUN, 695700e3, "#ffce76"),
  ...planets.map(([id, name, mass, radius, color, a, e, I, L, p, O]) => ({
    ...body(id, name, mass, radius, color),
    ...fromKepler(a * AU, e, I, O, p - O, L - p, G * (SUN + mass)),
  })),
];
const solarSource =
  "JPL Approximate Positions of the Planets（1800–2050表、T=0）。J2000.0 = 2000-01-01 12:00 TDB、J2000黄道・春分点の右手座標。地球の要素は地球–月重心の近似。初期化後に系の重心座標へ変換。精密暦ではありません。";
export const EXPERIMENTS: Experiment[] = [
  {
    id: "solar",
    name: "太陽系",
    label: "THE SOLAR SYSTEM",
    description: "8つの惑星、ひとつの重力の舞台。",
    guide:
      "まず再生して内惑星と外惑星の速さを比べましょう。天体リストで地球を選び「追跡」を使うと、動く視点から太陽系を観察できます。",
    source: solarSource,
    scale: 36 * AU,
    step: 1800,
    rate: 86400 * 12,
    world: barycentric({ time: 0, bodies: solarBodies() }),
  },
  {
    id: "inner",
    name: "内惑星",
    label: "INNER WORLDS",
    description: "軌道の速さに、距離がつける差。",
    guide:
      "水星は地球が一周する間に何周するでしょう？ 軌道周期と速度を比較し、速度を少し変更して軌道の変化を観察してください。",
    source: solarSource,
    scale: 2.1 * AU,
    step: 900,
    rate: 86400 * 3,
    world: barycentric({ time: 0, bodies: solarBodies().slice(0, 5) }),
  },
  {
    id: "moon",
    name: "地球と月",
    label: "A SHARED CENTER",
    description: "地球もまた、月に引かれている。",
    guide:
      "地球と月は共通重心を回ります。地球を追跡すると月の軌道が、重心へ戻すと地球の小さな動きが見えます。小さな衛星を追加して、月の摂動も調べられます。",
    source:
      "教育用の合成円軌道。平均地球–月距離384,400 km、軌道傾斜5.145°。日時を持つ実際の月の位置ではありません。",
    scale: 5e8,
    step: 30,
    rate: 86400,
    world: barycentric({
      time: 0,
      bodies: [
        body("earth", "地球", 5.97237e24, 6371008.8, "#6ab9f2"),
        body(
          "moon",
          "月",
          7.342e22,
          1737400,
          "#bbc5ce",
          vec(384400e3),
          vec(
            0,
            Math.sqrt((G * (5.97237e24 + 7.342e22)) / 384400e3) *
              Math.cos((5.145 * Math.PI) / 180),
            Math.sqrt((G * (5.97237e24 + 7.342e22)) / 384400e3) *
              Math.sin((5.145 * Math.PI) / 180),
          ),
        ),
      ],
    }),
  },
  {
    id: "binary",
    name: "連星と惑星",
    label: "TWO SUNS, ONE WORLD",
    description: "二つの太陽がつくる、動く重力場。",
    guide:
      "質量が等しい連星のまわりを惑星が回ります。惑星の初速度を変えると、二つの恒星に揺さぶられる軌道を観察できます。長期安定性は保証されません。",
    source:
      "教育用の合成初期条件。恒星各1太陽質量、星間距離0.4 AU、惑星は1.8 AUの近似円軌道。",
    scale: 2.6 * AU,
    step: 600,
    rate: 86400 * 3,
    world: barycentric({
      time: 0,
      bodies: [
        body(
          "a",
          "恒星 A",
          SUN,
          695700e3,
          "#ffd58a",
          vec(-0.2 * AU),
          vec(0, -Math.sqrt((G * SUN) / (0.8 * AU))),
        ),
        body(
          "b",
          "恒星 B",
          SUN,
          695700e3,
          "#97c4ff",
          vec(0.2 * AU),
          vec(0, Math.sqrt((G * SUN) / (0.8 * AU))),
        ),
        body(
          "planet",
          "惑星",
          5.97237e24,
          6371008.8,
          "#81e4c2",
          vec(1.8 * AU),
          vec(0, Math.sqrt((G * SUN * 2) / (1.8 * AU))),
        ),
      ],
    }),
  },
  {
    id: "comet",
    name: "彗星の旅",
    label: "BEYOND THE PLANE",
    description: "傾いた楕円を、立体でとらえる。",
    guide:
      "3Dで回転させ、彗星の大きな軌道傾斜を見てください。近点付近で速く、遠点付近で遅くなります。破線は瞬間接触軌道であり、木星の摂動を含む未来予測ではありません。",
    source:
      "太陽・木星はJ2000近似。彗星は合成要素 a=3 AU, e=0.8, i=55°, Ω=35°, ω=40°, M=15°、質量10¹⁴ kg。特定の実在彗星ではありません。",
    scale: 6.5 * AU,
    step: 600,
    rate: 86400 * 5,
    world: barycentric({
      time: 0,
      bodies: [
        solarBodies()[0],
        solarBodies()[5],
        {
          ...body("comet", "彗星", 1e14, 3000, "#70efd5"),
          ...fromKepler(3 * AU, 0.8, 55, 35, 40, 15, G * SUN),
        },
      ],
    }),
  },
  {
    id: "resonance",
    name: "2 : 1 共鳴",
    label: "RHYTHM OF ORBITS",
    description: "軌道周期にひそむ、整数のリズム。",
    guide:
      "内側の小惑星の周期は木星のおよそ半分です。数年進め、会合の繰り返しと軌道要素の変化を観察してください。共鳴の全周期や長期安定性の再現には長時間の積分が必要です。",
    source:
      "教育用の合成太陽–木星–小惑星。木星5.2 AU、小惑星a=5.2/2^(2/3) AU, e=0.05, i=2°。",
    scale: 6.5 * AU,
    step: 1800,
    rate: 86400 * 20,
    world: barycentric({
      time: 0,
      bodies: [
        body("sun", "太陽", SUN, 695700e3, "#ffce76"),
        body(
          "jupiter",
          "木星",
          1.8982e27,
          69911e3,
          "#d5ba9a",
          vec(5.2 * AU),
          vec(0, Math.sqrt((G * SUN) / (5.2 * AU))),
        ),
        {
          ...body("asteroid", "小惑星", 1e15, 6000, "#acbaff"),
          ...fromKepler((5.2 * AU) / 2 ** (2 / 3), 0.05, 2, 0, 0, 100, G * SUN),
        },
      ],
    }),
  },
  {
    id: "assist",
    name: "重力アシスト",
    label: "BORROWED MOMENTUM",
    description: "動く惑星のそばで、進路が変わる。",
    guide:
      "探査機と木星の相対速度、および太陽基準の速度を比較しましょう。探査機のy位置と速度を変えると、木星の前側・後側を通る際のエネルギー交換が変わります。衝突の場合は近接前に停止します。",
    source:
      "教育用の合成太陽–木星–探査機。J2000暦ではありません。探査機は木星の内側0.04 AU、後方0.03 AUから出発。",
    scale: 0.12 * AU,
    step: 300,
    rate: 86400 * 0.3,
    world: barycentric({
      time: 0,
      bodies: [
        body("sun", "太陽", SUN, 695700e3, "#ffce76"),
        body(
          "jupiter",
          "木星",
          1.8982e27,
          69911e3,
          "#d5ba9a",
          vec(5.2 * AU),
          vec(0, Math.sqrt((G * SUN) / (5.2 * AU))),
        ),
        body(
          "probe",
          "探査機",
          1000,
          10,
          "#70efd5",
          vec(5.16 * AU, -0.03 * AU),
          vec(9000, 18000),
        ),
      ],
    }),
  },
];
