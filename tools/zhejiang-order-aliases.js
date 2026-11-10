(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZhejiangOrderAliases = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // Source: user-provided workbook, Sheet1 columns B/E/F, 2026-11-10.
  // Only complete promotion-name -> order-name pairs; no inferred names.
  const entries = [
  {
    "row": 3,
    "series": "鎏金系列",
    "name": "鎏金LJ101金蓝",
    "alias": "孔雀"
  },
  {
    "row": 4,
    "series": "鎏金系列",
    "name": "鎏金LJ102金棕",
    "alias": "朱颜"
  },
  {
    "row": 5,
    "series": "鎏金系列",
    "name": "鎏金LJ103银紫",
    "alias": "紫烟"
  },
  {
    "row": 7,
    "series": "鎏金系列",
    "name": "鎏金LJ105金黄",
    "alias": "金辉"
  },
  {
    "row": 8,
    "series": "鎏金系列",
    "name": "鎏金LJ106银蓝",
    "alias": "澜海"
  },
  {
    "row": 9,
    "series": "鎏金系列",
    "name": "鎏金LJ107黑金",
    "alias": "昼夜"
  },
  {
    "row": 11,
    "series": "鎏金系列",
    "name": "鎏金LJ114牛油果绿",
    "alias": "黛绿"
  },
  {
    "row": 12,
    "series": "鎏金系列",
    "name": "鎏金LJ115橄榄绿",
    "alias": "青榄"
  },
  {
    "row": 13,
    "series": "鎏金系列",
    "name": "鎏金LJ116黑森林",
    "alias": "黑森林"
  },
  {
    "row": 14,
    "series": "鎏金系列",
    "name": "鎏金LJ117车厘子红",
    "alias": "樱厘"
  },
  {
    "row": 15,
    "series": "鎏金系列",
    "name": "鎏金LJ118石榴红",
    "alias": "若榴"
  },
  {
    "row": 18,
    "series": "鎏金系列",
    "name": "鎏金LJ121金桔",
    "alias": "金茶"
  },
  {
    "row": 19,
    "series": "鎏金系列",
    "name": "鎏金LJ122白银",
    "alias": "白昼"
  },
  {
    "row": 21,
    "series": "鎏金系列",
    "name": "鎏金LJ124蓝金",
    "alias": "鸢尾"
  },
  {
    "row": 22,
    "series": "鎏金系列",
    "name": "鎏金LJ125北极星光黑",
    "alias": "星空"
  },
  {
    "row": 23,
    "series": "鎏金系列",
    "name": "鎏金LJ126青柠",
    "alias": "青柠"
  },
  {
    "row": 31,
    "series": "星闪砂系列",
    "name": "星闪砂XSS901冰蓝色乱纹",
    "alias": "星黎"
  },
  {
    "row": 32,
    "series": "星闪砂系列",
    "name": "星闪砂XSS902象牙黑",
    "alias": "烟墨"
  },
  {
    "row": 33,
    "series": "星闪砂系列",
    "name": "星闪砂XSS903蔚蓝色",
    "alias": "景泰"
  },
  {
    "row": 34,
    "series": "星闪砂系列",
    "name": "星闪砂XSS904玫瑰粉",
    "alias": "海棠"
  },
  {
    "row": 35,
    "series": "星闪砂系列",
    "name": "星闪砂XSS905竹青绿",
    "alias": "竹青"
  },
  {
    "row": 36,
    "series": "星闪砂系列",
    "name": "星闪砂XSS906松霜绿",
    "alias": "松霜"
  },
  {
    "row": 38,
    "series": "大漠沙丘系列",
    "name": "大漠沙丘DM201浅绿乱纹",
    "alias": "黛染"
  },
  {
    "row": 41,
    "series": "大漠沙丘系列",
    "name": "大漠沙丘DM204黄金乱纹",
    "alias": "金染"
  },
  {
    "row": 42,
    "series": "大漠沙丘系列",
    "name": "大漠DM205丹麦彩虹乱纹",
    "alias": "烟染"
  },
  {
    "row": 43,
    "series": "大漠沙丘系列",
    "name": "大漠DM206银-乱纹",
    "alias": "极昼"
  },
  {
    "row": 46,
    "series": "大漠沙丘系列",
    "name": "大漠沙丘DM209蓝色乱纹",
    "alias": "鸳染"
  },
  {
    "row": 48,
    "series": "大漠沙丘系列",
    "name": "大漠沙丘DM211金橙中乱纹",
    "alias": "夕染"
  },
  {
    "row": 51,
    "series": "大漠沙丘系列",
    "name": "大漠沙丘DM214海棠红乱纹",
    "alias": "红棠"
  },
  {
    "row": 54,
    "series": "大漠沙丘系列",
    "name": "大漠沙丘DM217玫瑰金乱纹",
    "alias": "柚染"
  },
  {
    "row": 55,
    "series": "大漠沙丘系列",
    "name": "大漠沙丘DM218赤金乱纹",
    "alias": "金昼"
  },
  {
    "row": 56,
    "series": "大漠沙丘系列",
    "name": "大漠沙丘DM219中国红",
    "alias": "中国红DM"
  },
  {
    "row": 58,
    "series": "大漠沙丘系列",
    "name": "大漠沙丘DM221松石绿",
    "alias": "松石绿"
  },
  {
    "row": 60,
    "series": "珠光釉系列",
    "name": "珠光釉ZGY1101红棕",
    "alias": "钨酒"
  },
  {
    "row": 61,
    "series": "珠光釉系列",
    "name": "珠光釉ZGY1102绿",
    "alias": "瓦松"
  },
  {
    "row": 62,
    "series": "珠光釉系列",
    "name": "珠光釉ZGY1103千代红",
    "alias": "朱砂"
  },
  {
    "row": 63,
    "series": "珠光釉系列",
    "name": "珠光釉ZGY1104玫紫",
    "alias": "玫紫"
  },
  {
    "row": 64,
    "series": "珠光釉系列",
    "name": "珠光釉ZGY1105黑",
    "alias": "黑光"
  },
  {
    "row": 65,
    "series": "珠光釉系列",
    "name": "珠光釉ZGY1106紫",
    "alias": "云紫"
  },
  {
    "row": 67,
    "series": "珠光釉系列",
    "name": "珠光釉ZGY1108粉",
    "alias": "花悦"
  },
  {
    "row": 68,
    "series": "珠光釉系列",
    "name": "珠光釉ZGY1109珠光釉白",
    "alias": "白光"
  },
  {
    "row": 69,
    "series": "珠光釉系列",
    "name": "珠光釉ZGY1110玫蓝",
    "alias": "莱茵"
  },
  {
    "row": 70,
    "series": "珠光釉系列",
    "name": "珠光釉ZGY1111深古铜",
    "alias": "古铜"
  },
  {
    "row": 73,
    "series": "仿锈系列",
    "name": "仿锈FX1201仿白锈",
    "alias": "白锈CG"
  },
  {
    "row": 74,
    "series": "仿锈系列",
    "name": "仿白锈（定制色-运河映巷）",
    "alias": "白锈DZ"
  },
  {
    "row": 75,
    "series": "仿锈系列",
    "name": "仿锈-（定制色-铁锈01）",
    "alias": "铁锈01"
  },
  {
    "row": 76,
    "series": "仿锈系列",
    "name": "仿锈FX1202仿黑锈",
    "alias": "黑锈A"
  },
  {
    "row": 77,
    "series": "仿锈系列",
    "name": "仿锈FX1203仿铁锈",
    "alias": "铁锈F"
  },
  {
    "row": 78,
    "series": "仿锈系列",
    "name": "仿锈FX1204仿红锈",
    "alias": "红绣"
  },
  {
    "row": 79,
    "series": "金丝绒系列",
    "name": "金丝绒JSR402孔雀",
    "alias": "碧玉"
  },
  {
    "row": 80,
    "series": "金丝绒系列",
    "name": "金丝绒JSR403翡翠",
    "alias": "琉璃"
  },
  {
    "row": 81,
    "series": "金丝绒系列",
    "name": "金丝绒JSR404银灰",
    "alias": "银箔"
  },
  {
    "row": 82,
    "series": "金丝绒系列",
    "name": "金丝绒JSR405雅黑",
    "alias": "黑月"
  },
  {
    "row": 83,
    "series": "金丝绒系列",
    "name": "金丝绒JSR406抹茶绿",
    "alias": "春夜"
  },
  {
    "row": 84,
    "series": "金丝绒系列",
    "name": "金丝绒JSR407橡白橙",
    "alias": "白橙"
  },
  {
    "row": 86,
    "series": "琼花系列",
    "name": "琼花QH301琼花灰",
    "alias": "桃灰"
  },
  {
    "row": 87,
    "series": "琼花系列",
    "name": "琼花QH302琼花粉",
    "alias": "桃粉"
  },
  {
    "row": 88,
    "series": "琼花系列",
    "name": "琼花QH303琼花蓝",
    "alias": "桃蓝"
  },
  {
    "row": 89,
    "series": "琼花系列",
    "name": "琼花QH304琼花绿",
    "alias": "桃绿"
  },
  {
    "row": 92,
    "series": "雪影系列",
    "name": "雪影XY2201粉黛雪融",
    "alias": "冰莓"
  },
  {
    "row": 93,
    "series": "雪影系列",
    "name": "雪影XY2202金橙映雪",
    "alias": "映雪"
  },
  {
    "row": 94,
    "series": "雪影系列",
    "name": "雪影XY2203雪粉",
    "alias": "雪粉"
  },
  {
    "row": 95,
    "series": "雪影系列",
    "name": "雪影XY2204雪绿",
    "alias": "雪绿"
  },
  {
    "row": 96,
    "series": "雪影系列",
    "name": "雪影-（定制色0806-DZMC）",
    "alias": "定制色0806-DZMC"
  },
  {
    "row": 97,
    "series": "云绸系列",
    "name": "云绸YC1401云绸红",
    "alias": "烛霞"
  },
  {
    "row": 98,
    "series": "云绸系列",
    "name": "云绸YC1402云绸棕",
    "alias": "烛珀"
  },
  {
    "row": 99,
    "series": "云绸系列",
    "name": "云绸YC1403云绸金",
    "alias": "烛金"
  },
  {
    "row": 100,
    "series": "云绸系列",
    "name": "云绸YC1404云绸黑",
    "alias": "烛黑"
  },
  {
    "row": 101,
    "series": "云绸系列",
    "name": "云绸YC1405云绸红铜",
    "alias": "铜紫YC"
  },
  {
    "row": 102,
    "series": "云绸系列",
    "name": "云绸YC1406云绸古铜",
    "alias": "黄铜YC"
  },
  {
    "row": 105,
    "series": "云绸系列",
    "name": "云绸YC1409云绸白",
    "alias": "云空白"
  },
  {
    "row": 106,
    "series": "云绸系列",
    "name": "云绸（定制色-石榴红）",
    "alias": "绯云"
  },
  {
    "row": 107,
    "series": "云绸系列",
    "name": "云绸（定制色-故宫红A）",
    "alias": "故宫红A"
  },
  {
    "row": 108,
    "series": "云绸系列",
    "name": "云绸（定制色-故宫红B）",
    "alias": "故宫红B"
  },
  {
    "row": 109,
    "series": "云绸系列",
    "name": "云绸（定制色-故宫红C）",
    "alias": "故宫红C"
  },
  {
    "row": 110,
    "series": "云绸系列",
    "name": "云绸（定制色-DZ-0508-铜金YC）",
    "alias": "铜金YC"
  },
  {
    "row": 111,
    "series": "云绸系列",
    "name": "云绸（定制色-1596）",
    "alias": "云冰蓝"
  },
  {
    "row": 112,
    "series": "云绸系列",
    "name": "云绸灰",
    "alias": "云空灰"
  },
  {
    "row": 113,
    "series": "珍珠绒系列",
    "name": "珠绒ZZR2101白胡桃-深色",
    "alias": "白柚S"
  },
  {
    "row": 114,
    "series": "珍珠绒系列",
    "name": "珍珠绒（白胡桃定制色浅色）",
    "alias": "白柚Q"
  },
  {
    "row": 115,
    "series": "铜铁锈系列",
    "name": "铜铁锈TX701铁锈",
    "alias": "铁锈"
  },
  {
    "row": 117,
    "series": "铜铁锈系列",
    "name": "铜铁锈TX703铜锈",
    "alias": "铜锈"
  },
  {
    "row": 118,
    "series": "铜铁锈系列",
    "name": "铜铁锈TX704铜铁锈",
    "alias": "铜铁锈"
  },
  {
    "row": 120,
    "series": "古铜系列",
    "name": "古铜GT501黄金",
    "alias": "金辉2.0"
  },
  {
    "row": 122,
    "series": "古铜系列",
    "name": "古铜GT503古铜",
    "alias": "铜金"
  },
  {
    "row": 123,
    "series": "古铜系列",
    "name": "古铜GT504红铜",
    "alias": "铜砂"
  },
  {
    "row": 124,
    "series": "绫罗系列",
    "name": "绫罗LL801绫罗棕",
    "alias": "钨棕"
  },
  {
    "row": 126,
    "series": "绫罗系列",
    "name": "绫罗LL803绫罗红",
    "alias": "钨红"
  },
  {
    "row": 128,
    "series": "绫罗系列",
    "name": "绫罗LL805绫罗橙",
    "alias": "钨橙"
  },
  {
    "row": 129,
    "series": "熔岩系列",
    "name": "熔岩RY1701火烧红云",
    "alias": "铁锈FBB"
  },
  {
    "row": 131,
    "series": "熔岩系列",
    "name": "熔岩RY1703黄石公园",
    "alias": "黄锈B"
  },
  {
    "row": 132,
    "series": "熔岩系列",
    "name": "熔岩RY1704埃特纳黑",
    "alias": "黑锈B"
  },
  {
    "row": 136,
    "series": "德克德勒系列",
    "name": "德克德勒DK1601红莲金",
    "alias": "金铜"
  },
  {
    "row": 139,
    "series": "德克德勒系列",
    "name": "德克德勒DK1604古斑银棕",
    "alias": "古棕"
  },
  {
    "row": 150,
    "series": "德克德勒系列",
    "name": "德克德勒DK1615绿莲金",
    "alias": "青铜"
  },
  {
    "row": 159,
    "series": "绢丝系列",
    "name": "绢丝JS1302绢丝迷夜黑",
    "alias": "夜银"
  },
  {
    "row": 164,
    "series": "绢丝系列",
    "name": "绢丝JS1307绢丝素白",
    "alias": "奶白"
  },
  {
    "row": 167,
    "series": "烟花系列",
    "name": "烟花YH1801珊瑚紫",
    "alias": "烟浅紫"
  },
  {
    "row": 168,
    "series": "烟花系列",
    "name": "烟花YH1802圣罗兰红",
    "alias": "烟红"
  },
  {
    "row": 169,
    "series": "烟花系列",
    "name": "烟花YH1803伽罗棕",
    "alias": "烟棕"
  },
  {
    "row": 170,
    "series": "幻影系列",
    "name": "幻影HY1901圣罗兰红",
    "alias": "云红"
  },
  {
    "row": 171,
    "series": "幻影系列",
    "name": "幻影HY1902珊瑚紫",
    "alias": "雾浅紫"
  },
  {
    "row": 172,
    "series": "幻影系列",
    "name": "幻影HY1903伽罗棕",
    "alias": "雾棕"
  },
  {
    "row": 173,
    "series": "幻影系列",
    "name": "幻影HY1904珊瑚蓝",
    "alias": "雾浅蓝"
  },
  {
    "row": 175,
    "series": "仿金属系列",
    "name": "仿金属FJS601紫铜",
    "alias": "铜紫"
  },
  {
    "row": 176,
    "series": "仿金属系列",
    "name": "仿金属FJS602黑铜",
    "alias": "铜黑"
  },
  {
    "row": 179,
    "series": "仿金属系列",
    "name": "仿金属FJS606深古铜",
    "alias": "铜棕"
  },
  {
    "row": 202,
    "series": "液态金属系列",
    "name": "液态金属CS-007金影流沙",
    "alias": "金焰液体金属"
  }
];
  const byAlias = new Map(entries.map(entry => [entry.alias, Object.freeze(entry)]));
  function resolve(value) {
    return byAlias.get(String(value || "").trim()) || null;
  }
  function priceName(value) {
    const entry = resolve(value);
    // Series is authoritative even when the order name uses an abbreviation.
    return entry ? entry.series.replace(/系列$/, "") : value;
  }
  function remarkPrefix(names, existing) {
    const seen = new Set();
    return names.map(resolve).filter(Boolean).map(entry => {
      const tag = "【" + entry.alias + "】";
      if (seen.has(tag) || String(existing || "").includes(tag)) return "";
      seen.add(tag);
      return tag;
    }).join("");
  }
  return Object.freeze({ entries: Object.freeze(entries), resolve, priceName, remarkPrefix });
});
