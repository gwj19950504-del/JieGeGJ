(function () {
  const liujinSpecs = [
    { value: "hard-2440", label: "硬质-1220*2440*6mm", width: 1.22, length: 2.44, unitWeight: 30, lengthType: "short", material: "hard", defaultSqmPrice: 70 },
    { value: "hard-3050", label: "硬质-1220*3050*6mm", width: 1.22, length: 3.05, unitWeight: 38, lengthType: "long", material: "hard", defaultSqmPrice: 70 },
    { value: "hard-600", label: "硬质-1200*600*6mm", width: 1.2, length: 0.6, unitWeight: 7.5, lengthType: "small", material: "hard", defaultSqmPrice: 70 },
    { value: "soft-2440", label: "软质-1200*2440*2~3mm", width: 1.2, length: 2.44, unitWeight: 15, lengthType: "short", material: "soft", defaultSqmPrice: 80 },
    { value: "soft-3000", label: "软质-1200*3000*2~3mm", width: 1.2, length: 3, unitWeight: 20, lengthType: "long", material: "soft", defaultSqmPrice: 80 }
  ];

  const liujinSeriesPriceGroups = [
    { names: ["珠光釉", "鎏金", "大漠沙丘", "大漠", "仿锈", "金丝绒", "琼花", "星闪砂"], prices: { "hard-2440": 70, "hard-3050": 70, "soft-2440": 80, "soft-3000": 80 } },
    { names: ["珍珠绒", "云绸"], prices: { "hard-2440": 75, "hard-3050": 75, "soft-2440": 85, "soft-3000": 85 } },
    { names: ["铜铁锈", "古铜", "绫罗", "熔岩", "锈语", "铜话"], prices: { "hard-2440": 80, "hard-3050": 80, "soft-2440": 90, "soft-3000": 90 } },
    { names: ["凤尾", "绢丝", "德克德勒"], prices: { "hard-2440": 85, "hard-3050": 85, "soft-2440": 95, "soft-3000": 95 } },
    { names: ["烟花", "幻影"], prices: { "hard-2440": 90, "hard-3050": 90, "soft-2440": 100, "soft-3000": 100 } },
    { names: ["仿金属", "钛金"], prices: { "hard-2440": 100, "hard-3050": 100, "soft-2440": 110, "soft-3000": 110 } },
    { names: ["珠光"], prices: { "hard-2440": 155, "hard-3050": 155, "soft-2440": 165, "soft-3000": 165 } },
    { names: ["液态金属"], prices: { "hard-2440": 105 } }
  ];

  const sandstoneSpecs = [
    { value: "sand-2440", label: "1220*2440*6mm", width: 1.22, length: 2.44, unitWeight: 30, lengthType: "short", material: "hard", defaultSqmPrice: 140 },
    { value: "sand-2400", label: "1200*2400*6mm", width: 1.2, length: 2.4, unitWeight: 30, lengthType: "short", material: "hard", defaultSqmPrice: 140 },
    { value: "sand-600", label: "1200*600*6mm", width: 1.2, length: 0.6, unitWeight: 7.5, lengthType: "small", material: "hard", defaultSqmPrice: 130 }
  ];

  const concretePriceTable = {
    "松诺": {
      flat: {
        small: { thin: 170, medium: 180, thick: 200 },
        large: { thin: 205, medium: 215, thick: 235 }
      },
      cave: {
        small: { thin: 170, medium: 180, thick: 200 },
        large: { thin: 205, medium: 215, thick: 235 }
      },
      texture: {
        short: { thin: 230, medium: 260, thick: 260 },
        long: { thin: 260, medium: 290, thick: 290 }
      }
    },
    "168": {
      flat: {
        small: { thin: 160, medium: 160, thick: 190 },
        large: { thin: 190, medium: 190, thick: 220 }
      },
      cave: {
        small: { thin: 160, medium: 160, thick: 190 },
        large: { thin: 190, medium: 190, thick: 220 }
      },
      texture: {
        short: { thin: 220, medium: 220, thick: 250 },
        long: { thin: 250, medium: 250, thick: 280 }
      }
    }
  };

  const ningboProductCatalog = [
    { name: "水泥浇筑板", price: 70, specs: ["3100*1180"] },
    { name: "水波纹板", price: 90, specs: ["3000*1150", "2750*1060", "2800*540"] },
    { name: "木浇筑板", price: 70, specs: ["2830*1140"] },
    { name: "洞石", price: 70, specs: ["2800*1200", "2400*1200"] },
    { name: "洞石", price: 50, specs: ["1200*600"] },
    { name: "新洞石（密孔）", price: 70, specs: ["2380*1160"] },
    { name: "海洞石", price: 75, specs: ["2400*1200"] },
    { name: "新版洞石", price: 70, specs: ["3000*1200", "2400*1200"] },
    { name: "粗纹线石", price: 80, specs: ["2380*1180", "2360*580"] },
    { name: "粗纹线石B款", price: 80, specs: ["2800*1200"] },
    { name: "新线石", price: 75, specs: ["2950*1200", "2700*1200"] },
    { name: "炭烧木", price: 75, specs: ["2850*930"] },
    { name: "大竹纹（凸模）", price: 85, specs: ["2950*1000", "2880*580"] },
    { name: "大竹纹（凹模）", price: 95, specs: ["2800*980"] },
    { name: "波浪石", price: 80, specs: ["1200*2750"] },
    { name: "波浪", price: 90, specs: ["3000*1200"] },
    { name: "中线石", price: 90, specs: ["1200*3000"] },
    { name: "脊线石", price: 80, specs: ["3000*1200"] },
    { name: "环型石", price: 90, specs: ["3000*1200"] },
    { name: "粗布纹", price: 80, specs: ["2800*1200"] },
    { name: "星云石", price: 85, specs: ["2830*1150"] },
    { name: "星云石B款", price: 85, specs: ["3000*1200"] },
    { name: "星月石", price: 85, specs: ["3100*1160", "2830*1150"] },
    { name: "星月石", price: 70, specs: ["1200*600"] },
    { name: "花岗岩", price: 78, specs: ["3000*1150"] },
    { name: "花岗岩", price: 48, specs: ["1200*600"] },
    { name: "花岗岩拼接", price: 80, specs: ["2700*1200"] },
    { name: "阡陌石（方线石）", price: 85, specs: ["2800*1000", "2800*580"] },
    { name: "脉络石", price: 85, specs: ["2800*990", "2800*1200", "2800*600"] },
    { name: "双线石", price: 90, specs: ["2650*1180"] },
    { name: "三角板（山纹）", price: 85, specs: ["1200*3000"] },
    { name: "泡沫铝", price: 100, specs: ["2800*1130"] },
    { name: "圆铝", price: 90, specs: ["2360*1160"] },
    { name: "锯木板", price: 85, specs: ["3100*1160"] },
    { name: "马赛克", price: 90, specs: ["1190*2990"] },
    { name: "方形马赛克", price: 80, specs: ["2950*1180"] },
    { name: "50马赛克小板1", price: 75, specs: ["1190*590"] },
    { name: "22马赛克小板2", price: 75, specs: ["1190*590"] },
    { name: "条石拼接", price: 75, specs: ["2800*1200"] },
    { name: "斧开石", price: 95, specs: ["3000*1200", "2300*560"] },
    { name: "黑山岩、劈开岩", price: 95, specs: ["3100*1160"] },
    { name: "黑山岩小板", price: 70, specs: ["1200*600"] },
    { name: "溶积岩", price: 100, specs: ["2950*1160"] },
    { name: "叠纹石（山岳石）", price: 100, specs: ["3100*1160"] },
    { name: "沉积岩", price: 125, specs: ["2850*1100"] },
    { name: "页岩", price: 125, specs: ["3100*1160"] },
    { name: "古木纹细", price: 80, specs: ["2950*1200"] },
    { name: "古木纹粗", price: 80, specs: ["3000*1200"] },
    { name: "大布纹石", price: 70, specs: ["2500*1160"] },
    { name: "玄武岩", price: 80, specs: ["3000*600"] },
    { name: "水泥板（打印）", price: 90, specs: ["2850*1150"] },
    { name: "平板", price: 80, specs: ["1160*2950", "1200*2400"] },
    { name: "锈石", price: 100, specs: ["2850*950"] },
    { name: "平面锈石", price: 100, specs: ["1160*2950", "1200*2400"] },
    { name: "鎏金板软质", price: 95, specs: ["2950*1160"] },
    { name: "鎏金板硬质", price: 85, specs: ["3000*1220", "2440*1220"] },
    { name: "麻编（小）", price: 70, specs: ["1420*560"] },
    { name: "麻编（大）", price: 77, specs: ["2650*1160"] },
    { name: "竹编/人字编", price: 75, specs: ["2360*1160"] },
    { name: "积木纹", price: 80, specs: ["2950*1180"] },
    { name: "条石纹", price: 80, specs: ["2900*1000"] },
    { name: "苹果叶", price: 90, specs: ["2950*1160"] },
    { name: "芭蕉叶", price: 90, specs: ["2900*1150"] },
    { name: "齿木纹", price: 90, specs: ["2950*1180"] },
    { name: "大齿木", price: 90, specs: ["2360*1160"] },
    { name: "水立方", price: 90, specs: ["3000*1140"] },
    { name: "木立方（山竹板）", price: 90, specs: ["2950*1160"] },
    { name: "夯土砖", price: 95, specs: ["2850*1000"] },
    { name: "15线石（金属色）", price: 95, specs: ["2950*1180"] },
    { name: "35线石（金属色）", price: 95, specs: ["2950*1180"] },
    { name: "23线石（金属色）", price: 95, specs: ["2950*1180"] },
    { name: "71线石（金属色）", price: 95, specs: ["2950*1180"] },
    { name: "摩洛石（金属色）", price: 95, specs: ["2950*1180"] },
    { name: "峭壁岩", price: 75, specs: ["1060*590"] },
    { name: "岩板", price: 80, specs: ["1160*2950"] },
    { name: "岩板3D", price: 90, specs: ["1160*2950"] },
    { name: "大理石3D", price: 90, specs: ["1160*2950", "1200*2400"] },
    { name: "莱姆石3D", price: 90, specs: ["2800*1200"] },
    { name: "粗夯土3D", price: 85, specs: ["3000*1200", "2900*1160", "2800*1030", "2680*930"] },
    { name: "云丘", price: 90, specs: ["2950*1160"] },
    { name: "山丘", price: 90, specs: ["2680*1180"] },
    { name: "20圆柱", price: 95, specs: ["3000*1200"] },
    { name: "30内圆", price: 90, specs: ["3000*1200"] },
    { name: "100内圆", price: 105, specs: ["3000*590"] },
    { name: "大峭壁岩", price: 95, specs: ["3000*1200"] },
    { name: "腾编", price: 95, specs: ["3000*1200"] },
    { name: "麻编", price: 95, specs: ["3000*1200"] },
    { name: "洞石拼接", price: 100, specs: ["3000*1200"] },
    { name: "岁月痕", price: 95, specs: ["3000*1200"] },
    { name: "斧凿石", price: 95, specs: ["3000*1200"] },
    { name: "山峰石", price: 115, specs: ["3000*1200"] },
    { name: "拼接文化石", price: 95, specs: ["2800*1200"] },
    { name: "条形文化石", price: 95, specs: ["2800*1200"] },
    { name: "大板岩", price: 90, specs: ["3000*1200"] },
    { name: "3D洞石", price: 75, specs: ["1200*2400", "1200*2800"] },
    { name: "3D洞石", price: 55, specs: ["1200*600"] },
    { name: "3D新版洞石", price: 75, specs: ["1200*2400", "1200*2800", "1200*3000"] },
    { name: "3D新版洞石", price: 55, specs: ["1200*600"] }
  ];

  const meililaiProductCatalog = [
  {
    "id": "mll-3",
    "name": "粗布纹石",
    "aliases": [],
    "price": 67,
    "spec": "580*1220",
    "thickness": "3-5mm",
    "weight": "3.75KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 3
  },
  {
    "id": "mll-4",
    "name": "粗布纹石",
    "aliases": [],
    "price": 67,
    "spec": "1175*2440",
    "thickness": "3-5mm",
    "weight": "15KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 4
  },
  {
    "id": "mll-6",
    "name": "细布纹石",
    "aliases": [],
    "price": 55,
    "spec": "600*1200",
    "thickness": "2-3mm",
    "weight": "2.8KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 6
  },
  {
    "id": "mll-7",
    "name": "细布纹石",
    "aliases": [],
    "price": 55,
    "spec": "1200*2400",
    "thickness": "2-3mm",
    "weight": "11.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 7
  },
  {
    "id": "mll-9",
    "name": "大细布纹",
    "aliases": [],
    "price": 55,
    "spec": "585*2975",
    "thickness": "2-3mm",
    "weight": "7.6KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 9
  },
  {
    "id": "mll-10",
    "name": "大细布纹",
    "aliases": [],
    "price": 55,
    "spec": "1200*3000（新）",
    "thickness": "2-3mm",
    "weight": "15KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 10
  },
  {
    "id": "mll-12",
    "name": "直纹线石 （原名：细布纹石）",
    "aliases": [
      "细布纹石",
      "直纹线石"
    ],
    "price": 55,
    "spec": "600*1500",
    "thickness": "2-3mm",
    "weight": "3.8KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 12
  },
  {
    "id": "mll-15",
    "name": "麻编",
    "aliases": [],
    "price": 55,
    "spec": "600*1200",
    "thickness": "2-4mm",
    "weight": "3.4KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 15
  },
  {
    "id": "mll-16",
    "name": "麻编",
    "aliases": [],
    "price": 55,
    "spec": "1200*2400",
    "thickness": "2-4mm",
    "weight": "14KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 16
  },
  {
    "id": "mll-17",
    "name": "麻编",
    "aliases": [],
    "price": 55,
    "spec": "1200*3000",
    "thickness": "2-4mm",
    "weight": "17.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 17
  },
  {
    "id": "mll-18",
    "name": "细麻编",
    "aliases": [],
    "price": 55,
    "spec": "600*1200",
    "thickness": "2-4mm",
    "weight": "3.2KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 18
  },
  {
    "id": "mll-21",
    "name": "辰美小洞石特价",
    "aliases": [],
    "price": 40,
    "spec": "580*1200（老版）",
    "thickness": "2-3mm",
    "weight": "2.7KG/块",
    "condition": "纯白、米白",
    "note": "",
    "importantNote": false,
    "sourceRow": 21
  },
  {
    "id": "mll-22",
    "name": "辰美小洞石特价",
    "aliases": [],
    "price": 40,
    "spec": "1195*2400（老版）",
    "thickness": "2-3mm",
    "weight": "16KG/块",
    "condition": "纯白、米白",
    "note": "特价款只有纯白和米白",
    "importantNote": true,
    "sourceRow": 22
  },
  {
    "id": "mll-24",
    "name": "辰美小洞石特价",
    "aliases": [],
    "price": 40,
    "spec": "600*1200",
    "thickness": "2-3mm",
    "weight": "3.5KG/块",
    "condition": "纯白、米白",
    "note": "",
    "importantNote": false,
    "sourceRow": 24
  },
  {
    "id": "mll-25",
    "name": "辰美小洞石特价",
    "aliases": [],
    "price": 40,
    "spec": "600*2400",
    "thickness": "2-3mm",
    "weight": "7KG/块",
    "condition": "纯白、米白",
    "note": "特价款只有纯白和米白",
    "importantNote": true,
    "sourceRow": 25
  },
  {
    "id": "mll-26",
    "name": "辰美小洞石特价",
    "aliases": [],
    "price": 40,
    "spec": "1200*2400",
    "thickness": "2-3mm",
    "weight": "14KG/块",
    "condition": "纯白、米白",
    "note": "",
    "importantNote": false,
    "sourceRow": 26
  },
  {
    "id": "mll-27",
    "name": "辰美小洞石特价",
    "aliases": [],
    "price": 40,
    "spec": "1200*3000",
    "thickness": "2-3mm",
    "weight": "17.5KG/块",
    "condition": "纯白、米白",
    "note": "",
    "importantNote": false,
    "sourceRow": 27
  },
  {
    "id": "mll-28",
    "name": "小洞石（美利来非特价产品）",
    "aliases": [
      "小洞石"
    ],
    "price": 50,
    "spec": "590*1190",
    "thickness": "2-3mm",
    "weight": "3.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": true,
    "sourceRow": 28
  },
  {
    "id": "mll-29",
    "name": "小洞石（美利来非特价产品）",
    "aliases": [
      "小洞石"
    ],
    "price": 50,
    "spec": "590*2390",
    "thickness": "2-3mm",
    "weight": "7KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 29
  },
  {
    "id": "mll-31",
    "name": "小洞石（美利来非特价产品）",
    "aliases": [
      "小洞石"
    ],
    "price": 50,
    "spec": "1190*2390",
    "thickness": "2-3mm",
    "weight": "14KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 31
  },
  {
    "id": "mll-32",
    "name": "小洞石（美利来非特价产品）",
    "aliases": [
      "小洞石"
    ],
    "price": 50,
    "spec": "1200*2880",
    "thickness": "2-3mm",
    "weight": "16KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 32
  },
  {
    "id": "mll-34",
    "name": "虫洞石",
    "aliases": [],
    "price": 75,
    "spec": "1175*2340",
    "thickness": "5mm",
    "weight": "20KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 34
  },
  {
    "id": "mll-37",
    "name": "鎏金洞石",
    "aliases": [],
    "price": 55,
    "spec": "600*1200",
    "thickness": "2-3mm",
    "weight": "3KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 37
  },
  {
    "id": "mll-38",
    "name": "鎏金洞石",
    "aliases": [],
    "price": 55,
    "spec": "600*2400",
    "thickness": "2-3mm",
    "weight": "6KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 38
  },
  {
    "id": "mll-39",
    "name": "鎏金洞石",
    "aliases": [],
    "price": 55,
    "spec": "1200*2400",
    "thickness": "2-3mm",
    "weight": "12KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 39
  },
  {
    "id": "mll-40",
    "name": "打印款洞石",
    "aliases": [],
    "price": 55,
    "spec": "600*1200",
    "thickness": "2-3mm",
    "weight": "3.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 40
  },
  {
    "id": "mll-41",
    "name": "打印款洞石",
    "aliases": [],
    "price": 55,
    "spec": "580*1200（老版）",
    "thickness": "2-3mm",
    "weight": "3KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 41
  },
  {
    "id": "mll-43",
    "name": "打印款洞石",
    "aliases": [],
    "price": 60,
    "spec": "600*2400",
    "thickness": "2-3mm",
    "weight": "7KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 43
  },
  {
    "id": "mll-46",
    "name": "打印款洞石",
    "aliases": [],
    "price": 60,
    "spec": "1200*2400",
    "thickness": "2-3mm",
    "weight": "14KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 46
  },
  {
    "id": "mll-49",
    "name": "打印款洞石",
    "aliases": [],
    "price": 70,
    "spec": "600*2880",
    "thickness": "2-3mm",
    "weight": "8KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 49
  },
  {
    "id": "mll-52",
    "name": "打印款洞石",
    "aliases": [],
    "price": 70,
    "spec": "1200*2880",
    "thickness": "2-3mm",
    "weight": "16KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 52
  },
  {
    "id": "mll-53",
    "name": "打印款洞石",
    "aliases": [],
    "price": 70,
    "spec": "1200*3000（辰美尺寸）",
    "thickness": "2-3mm",
    "weight": "17.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 53
  },
  {
    "id": "mll-55",
    "name": "竖纹流水石（老）",
    "aliases": [
      "竖纹流水石"
    ],
    "price": 60,
    "spec": "575*1175",
    "thickness": "3-5mm",
    "weight": "4.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 55
  },
  {
    "id": "mll-58",
    "name": "横纹流水石（新）",
    "aliases": [
      "横纹流水石"
    ],
    "price": 60,
    "spec": "600*1200",
    "thickness": "3-5mm",
    "weight": "4.2KG/块",
    "condition": "",
    "note": "2025.9月新品",
    "importantNote": false,
    "sourceRow": 58
  },
  {
    "id": "mll-61",
    "name": "条形石",
    "aliases": [],
    "price": 60,
    "spec": "575*1175",
    "thickness": "3-5mm",
    "weight": "4.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 61
  },
  {
    "id": "mll-64",
    "name": "辰美板岩（单色）",
    "aliases": [
      "辰美板岩"
    ],
    "price": 40,
    "spec": "600*1200",
    "thickness": "2-3mm",
    "weight": "3KG/块",
    "condition": "纯白、米白",
    "note": "",
    "importantNote": true,
    "sourceRow": 64
  },
  {
    "id": "mll-65",
    "name": "辰美板岩（单色）",
    "aliases": [
      "辰美板岩"
    ],
    "price": 45,
    "spec": "1200*2400",
    "thickness": "2-3mm",
    "weight": "12KG/块",
    "condition": "纯白、米白",
    "note": "特价款只有纯白和米白",
    "importantNote": true,
    "sourceRow": 65
  },
  {
    "id": "mll-66",
    "name": "辰美板岩（单色）",
    "aliases": [
      "辰美板岩"
    ],
    "price": 45,
    "spec": "1200*3000",
    "thickness": "2-3mm",
    "weight": "15KG/块",
    "condition": "纯白、米白",
    "note": "",
    "importantNote": true,
    "sourceRow": 66
  },
  {
    "id": "mll-67",
    "name": "板岩（美利来非特价产品）",
    "aliases": [
      "板岩"
    ],
    "price": 50,
    "spec": "590*1190",
    "thickness": "2-3mm",
    "weight": "3KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 67
  },
  {
    "id": "mll-68",
    "name": "板岩（美利来非特价产品）",
    "aliases": [
      "板岩"
    ],
    "price": 50,
    "spec": "590*2390",
    "thickness": "2-3mm",
    "weight": "6KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 68
  },
  {
    "id": "mll-69",
    "name": "板岩（美利来非特价产品）",
    "aliases": [
      "板岩"
    ],
    "price": 50,
    "spec": "1190*2390",
    "thickness": "2-3mm",
    "weight": "12KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 69
  },
  {
    "id": "mll-70",
    "name": "板岩（福美纹理）",
    "aliases": [
      "板岩"
    ],
    "price": 50,
    "spec": "600*1200",
    "thickness": "2-3mm",
    "weight": "3KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 70
  },
  {
    "id": "mll-73",
    "name": "板岩打印款",
    "aliases": [],
    "price": 55,
    "spec": "600*1200",
    "thickness": "2-3mm",
    "weight": "3KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 73
  },
  {
    "id": "mll-74",
    "name": "板岩打印款",
    "aliases": [],
    "price": 70,
    "spec": "1200*2400",
    "thickness": "2-3mm",
    "weight": "12KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 74
  },
  {
    "id": "mll-75",
    "name": "板岩打印款",
    "aliases": [],
    "price": 70,
    "spec": "1200*3000（辰美尺寸）",
    "thickness": "2-3mm",
    "weight": "15KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 75
  },
  {
    "id": "mll-76",
    "name": "海底洞石",
    "aliases": [],
    "price": 80,
    "spec": "1190*2750",
    "thickness": "3-5mm",
    "weight": "20KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 76
  },
  {
    "id": "mll-79",
    "name": "貝磊石",
    "aliases": [
      "贝磊石"
    ],
    "price": 55,
    "spec": "570*1200",
    "thickness": "2-3mm",
    "weight": "3KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 79
  },
  {
    "id": "mll-82",
    "name": "石皮",
    "aliases": [],
    "price": 55,
    "spec": "590*1180",
    "thickness": "2-3mm",
    "weight": "3.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 82
  },
  {
    "id": "mll-83",
    "name": "石皮",
    "aliases": [],
    "price": 55,
    "spec": "1190*2390",
    "thickness": "2-3mm",
    "weight": "",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 83
  },
  {
    "id": "mll-85",
    "name": "夯土板（细）",
    "aliases": [
      "夯土板"
    ],
    "price": 50,
    "spec": "560*2360",
    "thickness": "2-3mm",
    "weight": "6KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 85
  },
  {
    "id": "mll-86",
    "name": "夯土板（细）",
    "aliases": [
      "夯土板"
    ],
    "price": 50,
    "spec": "1200*3000",
    "thickness": "2-3mm",
    "weight": "15KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 86
  },
  {
    "id": "mll-88",
    "name": "夯土板（复合色）",
    "aliases": [
      "夯土板"
    ],
    "price": 60,
    "spec": "560*2360",
    "thickness": "2-3mm",
    "weight": "6KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 88
  },
  {
    "id": "mll-91",
    "name": "粗夯土板（单色）",
    "aliases": [
      "粗夯土板"
    ],
    "price": 55,
    "spec": "1190*2690",
    "thickness": "2-3mm",
    "weight": "15KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 91
  },
  {
    "id": "mll-94",
    "name": "粗夯土板（复合色）",
    "aliases": [
      "粗夯土板"
    ],
    "price": 67,
    "spec": "1190*2690",
    "thickness": "2-3mm",
    "weight": "15KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 94
  },
  {
    "id": "mll-97",
    "name": "辰美夯土板",
    "aliases": [],
    "price": 50,
    "spec": "1200*2400",
    "thickness": "2-3mm",
    "weight": "14KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 97
  },
  {
    "id": "mll-98",
    "name": "辰美夯土板",
    "aliases": [],
    "price": 50,
    "spec": "1200*3000",
    "thickness": "2-3mm",
    "weight": "15KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 98
  },
  {
    "id": "mll-100",
    "name": "打印款夯土板",
    "aliases": [],
    "price": 55,
    "spec": "600*1200",
    "thickness": "2-3mm",
    "weight": "3.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 100
  },
  {
    "id": "mll-101",
    "name": "打印款夯土板",
    "aliases": [],
    "price": 70,
    "spec": "600*2400",
    "thickness": "2-3mm",
    "weight": "7KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 101
  },
  {
    "id": "mll-102",
    "name": "打印款夯土板",
    "aliases": [],
    "price": 70,
    "spec": "1200*2400",
    "thickness": "2-3mm",
    "weight": "14KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 102
  },
  {
    "id": "mll-103",
    "name": "打印款夯土板",
    "aliases": [],
    "price": 70,
    "spec": "1200*3000",
    "thickness": "2-3mm",
    "weight": "15KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 103
  },
  {
    "id": "mll-104",
    "name": "融景夯土板",
    "aliases": [],
    "price": 80,
    "spec": "590*2980",
    "thickness": "3-6mm",
    "weight": "10KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 104
  },
  {
    "id": "mll-107",
    "name": "雨落夯土",
    "aliases": [],
    "price": 75,
    "spec": "1200*2400",
    "thickness": "2-3mm",
    "weight": "20KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 107
  },
  {
    "id": "mll-110",
    "name": "落珠板",
    "aliases": [],
    "price": 75,
    "spec": "600*3000",
    "thickness": "2-3mm",
    "weight": "12KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 110
  },
  {
    "id": "mll-111",
    "name": "落珠板",
    "aliases": [],
    "price": 75,
    "spec": "1200*3000",
    "thickness": "2-3mm",
    "weight": "24kg/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 111
  },
  {
    "id": "mll-113",
    "name": "银沙夯土",
    "aliases": [],
    "price": 55,
    "spec": "600*1200",
    "thickness": "2-3mm",
    "weight": "3.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 113
  },
  {
    "id": "mll-114",
    "name": "银沙夯土",
    "aliases": [],
    "price": 55,
    "spec": "600*2400",
    "thickness": "2-3mm",
    "weight": "7KG",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 114
  },
  {
    "id": "mll-115",
    "name": "银沙夯土",
    "aliases": [],
    "price": 55,
    "spec": "1200*2400",
    "thickness": "2-3mm",
    "weight": "14KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 115
  },
  {
    "id": "mll-116",
    "name": "流痕板",
    "aliases": [],
    "price": 75,
    "spec": "1200*2400",
    "thickness": "2-3mm",
    "weight": "20KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 116
  },
  {
    "id": "mll-119",
    "name": "旧土墙",
    "aliases": [],
    "price": 80,
    "spec": "1200*2640",
    "thickness": "3-5mm",
    "weight": "20KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 119
  },
  {
    "id": "mll-122",
    "name": "仿古砖",
    "aliases": [],
    "price": 31,
    "spec": "60*230",
    "thickness": "2-3mm",
    "weight": "23KG/箱",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 122
  },
  {
    "id": "mll-125",
    "name": "劈开砖",
    "aliases": [],
    "price": 31,
    "spec": "60*240",
    "thickness": "2-3mm",
    "weight": "25KG/箱",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 125
  },
  {
    "id": "mll-128",
    "name": "连体砖",
    "aliases": [],
    "price": 45,
    "spec": "400*2300",
    "thickness": "2-3mm",
    "weight": "3.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 128
  },
  {
    "id": "mll-129",
    "name": "连体砖",
    "aliases": [],
    "price": 45,
    "spec": "1210*2300",
    "thickness": "2-3mm",
    "weight": "10KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 129
  },
  {
    "id": "mll-131",
    "name": "辰美新线石",
    "aliases": [],
    "price": 47,
    "spec": "1200*2400",
    "thickness": "2-3mm",
    "weight": "12KG/块",
    "condition": "纯白、米白",
    "note": "计划3月份上新",
    "importantNote": false,
    "sourceRow": 131
  },
  {
    "id": "mll-132",
    "name": "辰美新线石",
    "aliases": [],
    "price": 47,
    "spec": "1200*3000",
    "thickness": "2-3mm",
    "weight": "15KG/块",
    "condition": "纯白、米白",
    "note": "计划3月份上新",
    "importantNote": false,
    "sourceRow": 132
  },
  {
    "id": "mll-133",
    "name": "标准新线石（美利来非特价产品）",
    "aliases": [
      "标准新线石"
    ],
    "price": 55,
    "spec": "590*1200",
    "thickness": "2-3mm",
    "weight": "3KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 133
  },
  {
    "id": "mll-134",
    "name": "标准新线石（美利来非特价产品）",
    "aliases": [
      "标准新线石"
    ],
    "price": 55,
    "spec": "590*2400",
    "thickness": "2-3mm",
    "weight": "6KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 134
  },
  {
    "id": "mll-135",
    "name": "标准新线石（美利来非特价产品）",
    "aliases": [
      "标准新线石"
    ],
    "price": 55,
    "spec": "1190*2400",
    "thickness": "2-3mm",
    "weight": "12KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 135
  },
  {
    "id": "mll-136",
    "name": "标准新线石（美利来非特价产品）",
    "aliases": [
      "标准新线石"
    ],
    "price": 55,
    "spec": "600*3240",
    "thickness": "2-3mm",
    "weight": "8KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 136
  },
  {
    "id": "mll-137",
    "name": "标准新线石（美利来非特价产品）",
    "aliases": [
      "标准新线石"
    ],
    "price": 55,
    "spec": "1200*3230",
    "thickness": "2-3mm",
    "weight": "16KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 137
  },
  {
    "id": "mll-139",
    "name": "阡陌石",
    "aliases": [],
    "price": 67,
    "spec": "590*1190",
    "thickness": "3-5mm",
    "weight": "4.1KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 139
  },
  {
    "id": "mll-140",
    "name": "阡陌石",
    "aliases": [],
    "price": 67,
    "spec": "590*2390",
    "thickness": "3-5mm",
    "weight": "8.3KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 140
  },
  {
    "id": "mll-141",
    "name": "阡陌石",
    "aliases": [],
    "price": 67,
    "spec": "1190*2390",
    "thickness": "3-5mm",
    "weight": "16.7KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 141
  },
  {
    "id": "mll-142",
    "name": "阡陌石",
    "aliases": [],
    "price": 67,
    "spec": "1200*3000",
    "thickness": "3-5mm",
    "weight": "24kg/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 142
  },
  {
    "id": "mll-143",
    "name": "大星月（小版）",
    "aliases": [
      "大星月"
    ],
    "price": 67,
    "spec": "600*1200",
    "thickness": "3-7mm",
    "weight": "8KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 143
  },
  {
    "id": "mll-146",
    "name": "大星月石",
    "aliases": [],
    "price": 75,
    "spec": "1170*3230",
    "thickness": "3-7mm",
    "weight": "30KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 146
  },
  {
    "id": "mll-149",
    "name": "小魔方",
    "aliases": [],
    "price": 67,
    "spec": "300*600",
    "thickness": "2-3mm",
    "weight": "1.35KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 149
  },
  {
    "id": "mll-152",
    "name": "水泥板",
    "aliases": [],
    "price": 67,
    "spec": "550*2760",
    "thickness": "3-4mm",
    "weight": "7.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 152
  },
  {
    "id": "mll-153",
    "name": "水泥板",
    "aliases": [],
    "price": 67,
    "spec": "1100*2760",
    "thickness": "3-4mm",
    "weight": "15KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 153
  },
  {
    "id": "mll-155",
    "name": "双线脉络石",
    "aliases": [],
    "price": 67,
    "spec": "580*2650",
    "thickness": "3-5mm",
    "weight": "11KG",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 155
  },
  {
    "id": "mll-156",
    "name": "双线脉络石",
    "aliases": [],
    "price": 67,
    "spec": "1175*2650",
    "thickness": "3-5mm",
    "weight": "22KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 156
  },
  {
    "id": "mll-158",
    "name": "大板脉络石",
    "aliases": [],
    "price": 67,
    "spec": "1200*3000",
    "thickness": "3-5mm",
    "weight": "25KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 158
  },
  {
    "id": "mll-161",
    "name": "鎏金板（软板）",
    "aliases": [
      "鎏金板"
    ],
    "price": 90,
    "spec": "1200*2950",
    "thickness": "2-3mm",
    "weight": "17.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 161
  },
  {
    "id": "mll-164",
    "name": "鎏金板（硬板）",
    "aliases": [
      "鎏金板"
    ],
    "price": 90,
    "spec": "1220*2440",
    "thickness": "3mm/5mm/8mm",
    "weight": "18KG/块（5mm）",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 164
  },
  {
    "id": "mll-165",
    "name": "鎏金板（硬板）",
    "aliases": [
      "鎏金板"
    ],
    "price": 90,
    "spec": "1220*3000",
    "thickness": "3mm/5mm/8mm",
    "weight": "22KG/块（5mm）",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 165
  },
  {
    "id": "mll-167",
    "name": "波浪石",
    "aliases": [],
    "price": 80,
    "spec": "1190*2395",
    "thickness": "3-6mm",
    "weight": "22KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 167
  },
  {
    "id": "mll-170",
    "name": "洞石波浪板",
    "aliases": [],
    "price": 80,
    "spec": "600*1200",
    "thickness": "3-6mm",
    "weight": "5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 170
  },
  {
    "id": "mll-173",
    "name": "辰美小星月 （原名：辰美英安岩）",
    "aliases": [
      "辰美英安岩",
      "辰美小星月"
    ],
    "price": 40,
    "spec": "600*1200",
    "thickness": "2-3mm",
    "weight": "3KG/块",
    "condition": "纯白、米白",
    "note": "特价款只有纯白和米白",
    "importantNote": true,
    "sourceRow": 173
  },
  {
    "id": "mll-174",
    "name": "辰美小星月 （原名：辰美英安岩）",
    "aliases": [
      "辰美英安岩",
      "辰美小星月"
    ],
    "price": 40,
    "spec": "1200*2400",
    "thickness": "2-3mm",
    "weight": "12KG/块",
    "condition": "纯白、米白",
    "note": "特价款只有纯白和米白",
    "importantNote": true,
    "sourceRow": 174
  },
  {
    "id": "mll-175",
    "name": "辰美小星月 （原名：辰美英安岩）",
    "aliases": [
      "辰美英安岩",
      "辰美小星月"
    ],
    "price": 40,
    "spec": "1200*3000",
    "thickness": "2-3mm",
    "weight": "15KG/块",
    "condition": "纯白、米白",
    "note": "特价款只有纯白和米白",
    "importantNote": true,
    "sourceRow": 175
  },
  {
    "id": "mll-176",
    "name": "小星月 （原名：辰美英安岩）",
    "aliases": [
      "辰美英安岩",
      "小星月"
    ],
    "price": 47,
    "spec": "600*1200",
    "thickness": "2-3mm",
    "weight": "3KG/块",
    "condition": "除纯白、米白特价款颜色以外颜色",
    "note": "",
    "importantNote": true,
    "sourceRow": 176
  },
  {
    "id": "mll-177",
    "name": "小星月 （原名：辰美英安岩）",
    "aliases": [
      "辰美英安岩",
      "小星月"
    ],
    "price": 47,
    "spec": "1200*2400",
    "thickness": "2-3mm",
    "weight": "12KG/块",
    "condition": "除纯白、米白特价款颜色以外颜色",
    "note": "",
    "importantNote": true,
    "sourceRow": 177
  },
  {
    "id": "mll-178",
    "name": "小星月 （原名：辰美英安岩）",
    "aliases": [
      "辰美英安岩",
      "小星月"
    ],
    "price": 47,
    "spec": "1200*3000",
    "thickness": "2-3mm",
    "weight": "15KG/块",
    "condition": "除纯白、米白特价款颜色以外颜色",
    "note": "",
    "importantNote": true,
    "sourceRow": 178
  },
  {
    "id": "mll-179",
    "name": "毛面花岗岩",
    "aliases": [],
    "price": 45,
    "spec": "580*1200",
    "thickness": "2-3mm",
    "weight": "2.8KG/块",
    "condition": "纯白、米白",
    "note": "特价款只有纯白和米白",
    "importantNote": true,
    "sourceRow": 179
  },
  {
    "id": "mll-180",
    "name": "毛面花岗岩",
    "aliases": [],
    "price": 45,
    "spec": "1180*2400",
    "thickness": "2-3mm",
    "weight": "11.5KG/块",
    "condition": "纯白、米白",
    "note": "特价款只有纯白和米白",
    "importantNote": true,
    "sourceRow": 180
  },
  {
    "id": "mll-181",
    "name": "毛面花岗岩",
    "aliases": [],
    "price": 51,
    "spec": "580*1200",
    "thickness": "2-3mm",
    "weight": "2.8KG/块",
    "condition": "除纯白、米白特价款颜色以外颜色",
    "note": "",
    "importantNote": false,
    "sourceRow": 181
  },
  {
    "id": "mll-182",
    "name": "毛面花岗岩",
    "aliases": [],
    "price": 51,
    "spec": "1180*2400",
    "thickness": "2-3mm",
    "weight": "11.5KG/块",
    "condition": "除纯白、米白特价款颜色以外颜色",
    "note": "",
    "importantNote": false,
    "sourceRow": 182
  },
  {
    "id": "mll-183",
    "name": "鲁班木",
    "aliases": [],
    "price": 67,
    "spec": "600*2780",
    "thickness": "3mm",
    "weight": "9KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 183
  },
  {
    "id": "mll-184",
    "name": "鲁班木",
    "aliases": [],
    "price": 67,
    "spec": "1200*2780",
    "thickness": "3mm",
    "weight": "18KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 184
  },
  {
    "id": "mll-186",
    "name": "皮革纹/鎏金软底板",
    "aliases": [],
    "price": 67,
    "spec": "1200*3000",
    "thickness": "3mm",
    "weight": "17.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 186
  },
  {
    "id": "mll-189",
    "name": "皮革纹打印款",
    "aliases": [],
    "price": 80,
    "spec": "1200*3000",
    "thickness": "3mm",
    "weight": "18KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 189
  },
  {
    "id": "mll-192",
    "name": "碳化木",
    "aliases": [],
    "price": 73,
    "spec": "600*2800",
    "thickness": "3mm",
    "weight": "10KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 192
  },
  {
    "id": "mll-193",
    "name": "碳化木",
    "aliases": [],
    "price": 73,
    "spec": "1200*2800",
    "thickness": "3mm",
    "weight": "20KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 193
  },
  {
    "id": "mll-195",
    "name": "星云石",
    "aliases": [],
    "price": 67,
    "spec": "1200*2800",
    "thickness": "3-5mm",
    "weight": "18.6KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 195
  },
  {
    "id": "mll-196",
    "name": "星云石",
    "aliases": [],
    "price": 67,
    "spec": "1200*3000",
    "thickness": "3-5mm",
    "weight": "20KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 196
  },
  {
    "id": "mll-198",
    "name": "斧开石",
    "aliases": [],
    "price": 75,
    "spec": "1200*3000",
    "thickness": "3-5mm",
    "weight": "27KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 198
  },
  {
    "id": "mll-201",
    "name": "榉木板",
    "aliases": [],
    "price": 67,
    "spec": "1200*3000",
    "thickness": "3mm",
    "weight": "22KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 201
  },
  {
    "id": "mll-204",
    "name": "洞石马赛克",
    "aliases": [],
    "price": 87,
    "spec": "600*3000",
    "thickness": "3-6mm",
    "weight": "14KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 204
  },
  {
    "id": "mll-205",
    "name": "洞石马赛克",
    "aliases": [],
    "price": 87,
    "spec": "1175*2950",
    "thickness": "3-6mm",
    "weight": "28KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 205
  },
  {
    "id": "mll-207",
    "name": "发泡铝",
    "aliases": [],
    "price": 80,
    "spec": "1100*2750",
    "thickness": "3mm",
    "weight": "24KG/块",
    "condition": "",
    "note": "二次上色另加15元",
    "importantNote": true,
    "sourceRow": 207
  },
  {
    "id": "mll-210",
    "name": "珊瑚石",
    "aliases": [],
    "price": 93,
    "spec": "1200*2950",
    "thickness": "3-8mm",
    "weight": "38KG/块",
    "condition": "",
    "note": "涉及颜色：中国红 通体色每平方加40元； 半通体每平方加20元； 二次上色每平方加15元",
    "importantNote": true,
    "sourceRow": 210
  },
  {
    "id": "mll-213",
    "name": "树皮纹",
    "aliases": [],
    "price": 73,
    "spec": "1200*3000",
    "thickness": "2-3mm",
    "weight": "20KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 213
  },
  {
    "id": "mll-216",
    "name": "木纹浇筑板",
    "aliases": [],
    "price": 73,
    "spec": "1200*3000",
    "thickness": "2-3mm",
    "weight": "22KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 216
  },
  {
    "id": "mll-219",
    "name": "木纹",
    "aliases": [],
    "price": 60,
    "spec": "165*1200",
    "thickness": "2-3mm",
    "weight": "1.16KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 219
  },
  {
    "id": "mll-222",
    "name": "大木纹板",
    "aliases": [],
    "price": 73,
    "spec": "1200*2950",
    "thickness": "2-3mm",
    "weight": "20.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 222
  },
  {
    "id": "mll-225",
    "name": "新打印木纹",
    "aliases": [],
    "price": 67,
    "spec": "600*1200",
    "thickness": "2-3mm",
    "weight": "5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 225
  },
  {
    "id": "mll-226",
    "name": "新打印木纹",
    "aliases": [],
    "price": 80,
    "spec": "1200*2950",
    "thickness": "2-3mm",
    "weight": "20.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 226
  },
  {
    "id": "mll-227",
    "name": "粗纹星云石",
    "aliases": [],
    "price": 67,
    "spec": "1150*2850",
    "thickness": "3-5mm",
    "weight": "17.5KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 227
  },
  {
    "id": "mll-230",
    "name": "三棱砖",
    "aliases": [],
    "price": 80,
    "spec": "1200*3200",
    "thickness": "3-5mm",
    "weight": "27KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 230
  },
  {
    "id": "mll-233",
    "name": "竹编",
    "aliases": [],
    "price": 75,
    "spec": "600*1200",
    "thickness": "2-5mm",
    "weight": "3.8KG/块",
    "condition": "",
    "note": "2025.9月新品",
    "importantNote": false,
    "sourceRow": 233
  },
  {
    "id": "mll-234",
    "name": "竹编",
    "aliases": [],
    "price": 80,
    "spec": "1200*2400",
    "thickness": "2-5mm",
    "weight": "15KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 234
  },
  {
    "id": "mll-235",
    "name": "小城堡石",
    "aliases": [],
    "price": 60,
    "spec": "600*1200",
    "thickness": "2-5mm",
    "weight": "4.5KG/块",
    "condition": "",
    "note": "2025.9月新品",
    "importantNote": false,
    "sourceRow": 235
  },
  {
    "id": "mll-236",
    "name": "小城堡石",
    "aliases": [],
    "price": 75,
    "spec": "1200*2400",
    "thickness": "2-5mm",
    "weight": "18KG/块",
    "condition": "",
    "note": "",
    "importantNote": false,
    "sourceRow": 236
  },
  {
    "id": "mll-237",
    "name": "龙鳞石",
    "aliases": [],
    "price": 87,
    "spec": "1200*3000",
    "thickness": "2-4mm",
    "weight": "15KG/块",
    "condition": "",
    "note": "2025.10月新品",
    "importantNote": false,
    "sourceRow": 237
  },
  {
    "id": "mll-238",
    "name": "纵痕砂绫石",
    "aliases": [],
    "price": 60,
    "spec": "1200*3000",
    "thickness": "3mm",
    "weight": "17KG/块",
    "condition": "",
    "note": "2025.10月新品",
    "importantNote": false,
    "sourceRow": 238
  },
  {
    "id": "mll-239",
    "name": "绳编A",
    "aliases": [],
    "price": 75,
    "spec": "1160*2650",
    "thickness": "4mm",
    "weight": "13.5kg/块",
    "condition": "",
    "note": "2025.12月新品",
    "importantNote": false,
    "sourceRow": 239
  },
  {
    "id": "mll-240",
    "name": "绳编B",
    "aliases": [],
    "price": 75,
    "spec": "1160*2650",
    "thickness": "4mm",
    "weight": "13.5kg/块",
    "condition": "",
    "note": "2025.12月新品",
    "importantNote": false,
    "sourceRow": 240
  },
  {
    "id": "mll-241",
    "name": "鞭炮纹",
    "aliases": [],
    "price": 75,
    "spec": "1160*2650",
    "thickness": "4mm",
    "weight": "13.5kg/块",
    "condition": "",
    "note": "2025.12月新品",
    "importantNote": false,
    "sourceRow": 241
  },
  {
    "id": "mll-242",
    "name": "草编",
    "aliases": [],
    "price": 75,
    "spec": "1200*3000",
    "thickness": "4mm",
    "weight": "16kg/块",
    "condition": "",
    "note": "2025.12月新品",
    "importantNote": false,
    "sourceRow": 242
  },
  {
    "id": "mll-243",
    "name": "木纹（水曲柳）",
    "aliases": [
      "木纹"
    ],
    "price": 55,
    "spec": "1200*2400",
    "thickness": "3mm",
    "weight": "12.5kg/块",
    "condition": "",
    "note": "2026.1月新品",
    "importantNote": false,
    "sourceRow": 243
  },
  {
    "id": "mll-244",
    "name": "芭蕉叶",
    "aliases": [],
    "price": 75,
    "spec": "1200*3000",
    "thickness": "2-4mm",
    "weight": "20.5kg/块",
    "condition": "",
    "note": "2026.1月新品",
    "importantNote": false,
    "sourceRow": 244
  },
  {
    "id": "mll-245",
    "name": "罗马柱",
    "aliases": [],
    "price": 75,
    "spec": "1200*3000",
    "thickness": "2-6mm",
    "weight": "36kg/块",
    "condition": "",
    "note": "2026.1月新品",
    "importantNote": false,
    "sourceRow": 245
  },
  {
    "id": "mll-246",
    "name": "罗马柱拼板",
    "aliases": [],
    "price": 75,
    "spec": "620*1220",
    "thickness": "2-10mm",
    "weight": "7.5KG/块",
    "condition": "",
    "note": "2026.2月新品",
    "importantNote": false,
    "sourceRow": 246
  },
  {
    "id": "mll-247",
    "name": "碎石板",
    "aliases": [],
    "price": 75,
    "spec": "1200*3000",
    "thickness": "4mm",
    "weight": "22.5kg/块",
    "condition": "",
    "note": "2026.1月新品",
    "importantNote": false,
    "sourceRow": 247
  },
  {
    "id": "mll-248",
    "name": "月球石",
    "aliases": [],
    "price": 75,
    "spec": "1200*3000",
    "thickness": "5mm",
    "weight": "18kg/块",
    "condition": "",
    "note": "2026.1月新品",
    "importantNote": false,
    "sourceRow": 248
  },
  {
    "id": "mll-249",
    "name": "油业岩",
    "aliases": [],
    "price": 75,
    "spec": "1200*2900",
    "thickness": "3-8mm",
    "weight": "18kg/块",
    "condition": "",
    "note": "2026.1月新品",
    "importantNote": false,
    "sourceRow": 249
  },
  {
    "id": "mll-250",
    "name": "页岩石",
    "aliases": [],
    "price": 75,
    "spec": "1200*2900",
    "thickness": "4mm",
    "weight": "23.5kg/块",
    "condition": "",
    "note": "2026.1月新品",
    "importantNote": false,
    "sourceRow": 250
  },
  {
    "id": "mll-251",
    "name": "流星雨",
    "aliases": [],
    "price": 80,
    "spec": "1200*2900",
    "thickness": "2-10mm",
    "weight": "31.5kg/块",
    "condition": "",
    "note": "2026.1月新品",
    "importantNote": false,
    "sourceRow": 251
  }
];

  // 原始平方重量厚度表；规格沿用最新价格表，保留已确认的装箱厚度设置。
  // 按名称+规格精确匹配，禁止用“线石”等泛关键词替代具体产品参数。
  const ningboConfirmedWeightProfiles = {
    "夯土砖": {"2850*1000":[8.5,7]},
    "波浪石": {"2750*1200":[7,6]},
    "麻编": {"3000*1200":[8,5]},
    "双线石": {"2650*1180":[10,8]},
    "锈石": {"2850*950":[6.5,4]},
    "泡沫铝": {"2800*1130":[8,5]},
    "圆铝": {"2360*1160":[6.5,4]},
    "新线石": {"2950*1200":[6.5,4],"2700*1200":[6.5,4]},
    "花岗岩": {"3000*1150":[7,5],"1200*600":[7,5]},
    "玄武岩": {"3000*600":[7,5]},
    "方形马赛克": {"2950*1180":[6.5,4]},
    "星月石": {"3100*1160":[10,8],"2830*1150":[10,8],"1200*600":[8,8]},
    "沉积岩": {"2850*1100":[11,13]},
    "页岩": {"3100*1160":[13,15]},
    "溶积岩": {"2950*1160":[11,15]},
    "条石纹": {"2900*1000":[7,5]},
    "芭蕉叶": {"2900*1150":[7,6]},
    "齿木纹": {"2950*1180":[7,6]},
    "大齿木": {"2360*1160":[7,7]},
    "苹果叶": {"2950*1160":[7,6]},
    "水立方": {"3000*1140":[6.5,5]},
    "云丘": {"2950*1160":[6.5,5]},
    "山丘": {"2680*1180":[6.5,5]},
    "粗布纹": {"2800*1200":[7,5]},
    "中线石": {"3000*1200":[9,8]},
    "脊线石": {"3000*1200":[6.5,5]},
    "20圆柱": {"3000*1200":[8,7]},
    "30内圆": {"3000*1200":[8,7]},
    "斧开石": {"3000*1200":[11,13],"2300*560":[12,12]},
    "峭壁岩": {"1060*590":[9,10]},
    "岁月痕": {"3000*1200":[7.5,6]},
    "斧凿石": {"3000*1200":[7,6]},
    "大峭壁岩": {"3000*1200":[7,6]},
    "大板岩": {"3000*1200":[6.5,5]},
    "条石拼接": {"2800*1200":[8,8]},
    "水泥浇筑板": {"3100*1180":[6.5,5]},
    "水波纹板": {"3000*1150":[8.5,9],"2750*1060":[8.5,9],"2800*540":[8.5,9]},
    "木浇筑板": {"2830*1140":[6.5,5]},
    "粗纹线石": {"2380*1180":[7.5,7],"2360*580":[7.5,7]},
    "粗纹线石B款": {"2800*1200":[7.5,7]},
    "炭烧木": {"2850*930":[6.5,4]},
    "大竹纹（凸模）": {"2950*1000":[9,8],"2880*580":[9,8]},
    "大竹纹（凹模）": {"2800*980":[11,10]},
    "波浪": {"3000*1200":[7,6]},
    "环型石": {"3000*1200":[8,7]},
    "星云石": {"2830*1150":[10,8]},
    "星云石B款": {"3000*1200":[10,8]},
    "阡陌石（方线石）": {"2800*1000":[10,8],"2800*580":[10,8]},
    "脉络石": {"2800*990":[10,8],"2800*1200":[10,8],"2800*600":[10,8]},
    "锯木板": {"3100*1160":[8.5,7]},
    "50马赛克小板1": {"1190*590":[7,6]},
    "22马赛克小板2": {"1190*590":[7,6]},
    "黑山岩、劈开岩": {"3100*1160":[10,12]},
    "黑山岩小板": {"1200*600":[8,8]},
    "叠纹石（山岳石）": {"3100*1160":[11,12]},
    "古木纹细": {"2950*1200":[7,5]},
    "古木纹粗": {"3000*1200":[7,5]},
    "大布纹石": {"2500*1160":[6.5,5]},
    "麻编（小）": {"1420*560":[8,5]},
    "麻编（大）": {"2650*1160":[8,5]},
    "竹编/人字编": {"2360*1160":[6.5,5]},
    "积木纹": {"2950*1180":[6.5,5]},
    "木立方（山竹板）": {"2950*1160":[6.5,5]},
    "15线石（金属色）": {"2950*1180":[7.5,7]},
    "35线石（金属色）": {"2950*1180":[7.5,7]},
    "23线石（金属色）": {"2950*1180":[7.5,7]},
    "71线石（金属色）": {"2950*1180":[7,7]},
    "摩洛石（金属色）": {"2950*1180":[7,6]},
    "莱姆石3D": {"2800*1200":[6.5,4]},
    "粗夯土3D": {"3000*1200":[6.5,4],"2900*1160":[6.5,4],"2800*1030":[6.5,4],"2680*930":[6.5,4]},
    "100内圆": {"3000*590":[9,10]},
    "腾编": {"3000*1200":[7,5]},
    "拼接文化石": {"2800*1200":[8,8]},
    "条形文化石": {"2800*1200":[8,8]},
  };

  const ningboWeightRules = [
    { keys: ["脉络石", "圆线石"], kgPerSqm: 10, thickness: 8, family: "" },
    { keys: ["3d新版洞石", "新版洞石"], kgPerSqm: 7, thickness: 4.5, family: "洞石" },
    { keys: ["3d洞石", "洞石"], kgPerSqm: 6.5, smallKgPerSqm: 5, thickness: 4, smallThickness: 3, family: "洞石" },
    { keys: ["花岗岩"], kgPerSqm: 7, thickness: 5, family: "花岗岩" },
    { keys: ["星云石b款", "星云石", "星月石"], kgPerSqm: 10, smallKgPerSqm: 8, thickness: 8, family: "星月石" },
    { keys: ["黑山岩", "劈开岩"], kgPerSqm: 10, smallKgPerSqm: 8, thickness: 8, family: "黑山岩" },
    { keys: ["20圆柱", "30内圆"], kgPerSqm: 8, thickness: 7, family: "" },
    { keys: ["山丘", "云丘"], kgPerSqm: 6.5, thickness: 5, family: "" },
    { keys: ["条石拼接"], kgPerSqm: 8, thickness: 8, family: "" },
    { keys: ["莱姆石", "平板", "水泥浇筑板", "木浇筑板", "木纹板"], kgPerSqm: 6.5, thickness: 5, family: "" },
    { keys: ["波浪石", "波浪"], kgPerSqm: 7, thickness: 6, family: "" },
    { keys: ["粗夯土3d"], kgPerSqm: 6.5, thickness: 4, family: "" },
    { keys: ["波纹", "粗线石", "线石", "脊线石", "粗布纹"], kgPerSqm: 7.5, thickness: 7, family: "" },
    { keys: ["竹纹", "阡陌石", "方线石"], kgPerSqm: 9, thickness: 8, family: "" },
    { keys: ["马赛克"], kgPerSqm: 7, thickness: 6, family: "" },
    { keys: ["斧开石", "叠纹", "沉积岩", "页岩", "山岩石"], kgPerSqm: 11, thickness: 12, family: "" }
  ];

  function normalizeNingboText(value) {
    return String(value || "").replace(/\s+/g, "").toLowerCase();
  }

  function normalizeNingboSpec(value) {
    const clean = String(value || "")
      .replace(/\s+/g, "")
      .replace(/[xX×]/g, "*")
      .replace(/mm/ig, "");
    const values = clean.match(/\d+(?:\.\d+)?/g) || [];
    if (values.length < 2) return clean;
    const first = Number(values[0]);
    const second = Number(values[1]);
    const dims = [Math.max(first, second), Math.min(first, second)].map((item) => Number.isInteger(item) ? String(item) : String(item));
    return dims.join("*");
  }

  function findNingboVariant(name, spec) {
    const nameKey = normalizeNingboText(name);
    const specKey = normalizeNingboSpec(spec);
    if (!nameKey || !specKey) return null;
    const variants = ningboProductCatalog.filter((item) => normalizeNingboText(item.name) === nameKey);
    return variants.find((item) => item.specs.some((itemSpec) => normalizeNingboSpec(itemSpec) === specKey)) || null;
  }

  function findNingboWeightProfile(name, spec) {
    const nameKey = normalizeNingboText(name);
    if (!nameKey.includes("洞石")) {
      const product = ningboProductCatalog
        .filter((item) => nameKey.includes(normalizeNingboText(item.name)))
        .sort((a, b) => b.name.length - a.name.length)[0];
      const values = product && ningboConfirmedWeightProfiles[product.name]?.[normalizeNingboSpec(spec)];
      if (!values) return null;
      const family = product.name.includes("星云石") || product.name.includes("星月石") ? "星月石"
        : product.name.includes("花岗岩") ? "花岗岩" : product.name.includes("黑山岩") ? "黑山岩" : "";
      return { kgPerSqm: values[0], thickness: values[1], family };
    }
    const rule = ningboWeightRules.find((item) => item.keys.some((key) => nameKey.includes(normalizeNingboText(key))));
    if (!rule) return null;
    const specKey = normalizeNingboSpec(spec);
    const isSmall = specKey === "1200*600";
    return {
      kgPerSqm: isSmall && rule.smallKgPerSqm ? rule.smallKgPerSqm : rule.kgPerSqm,
      thickness: isSmall && rule.smallThickness ? rule.smallThickness : rule.thickness,
      family: rule.family || ""
    };
  }

  function groupedNingboCatalog() {
    const groups = new Map();
    ningboProductCatalog.forEach((item) => {
      if (!groups.has(item.name)) groups.set(item.name, { name: item.name, price: item.price, specs: [], variants: [], priceBySpec: {} });
      const target = groups.get(item.name);
      target.variants.push({ price: item.price, specs: [...item.specs] });
      item.specs.forEach((spec) => {
        if (!target.specs.includes(spec)) target.specs.push(spec);
        target.priceBySpec[normalizeNingboSpec(spec)] = item.price;
      });
      if (target.variants.some((variant) => variant.price !== target.price)) target.price = null;
    });
    return Array.from(groups.values());
  }

  function groupedMeililaiCatalog() {
    const groups = new Map();
    meililaiProductCatalog.forEach((item) => {
      const key = normalizeNingboText(item.name);
      if (!groups.has(key)) {
        groups.set(key, {
          name: item.name,
          aliases: [],
          variants: []
        });
      }
      const target = groups.get(key);
      (item.aliases || []).forEach((alias) => {
        if (alias && !target.aliases.includes(alias)) target.aliases.push(alias);
      });
      target.variants.push({ ...item });
    });
    return Array.from(groups.values());
  }

  function meililaiPackagingFee(products) {
    const items = (Array.isArray(products) ? products : []).filter((item) => Number(item?.qty) > 0);
    const totalQty = items.reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0);
    if (!totalQty || totalQty >= 5) {
      return { amount: 0, name: "", totalQty, confirmed: true, rule: totalQty >= 5 ? "合计5片及以上免包装费" : "" };
    }

    let requiredAmount = 0;
    for (const item of items) {
      const values = String(item.specText || item.spec || "").replace(/[×xX]/g, "*").match(/\d+(?:\.\d+)?/g) || [];
      if (values.length < 2 || /(?:^|[^\d])-\d/.test(String(item.specText || item.spec || ""))) {
        return { amount: 0, name: "", totalQty, confirmed: false, rule: "规格无法识别，请人工确认包装费" };
      }
      const first = Number(values[0]);
      const second = Number(values[1]);
      if (!Number.isFinite(first) || !Number.isFinite(second) || first <= 0 || second <= 0) {
        return { amount: 0, name: "", totalQty, confirmed: false, rule: "规格必须为正数，请人工确认包装费" };
      }
      const longSide = Math.max(first, second);
      const shortSide = Math.min(first, second);
      const itemAmount = shortSide <= 650 ? (longSide <= 1500 ? 10 : 100) : 200;
      requiredAmount = Math.max(requiredAmount, itemAmount);
    }

    return {
      amount: requiredAmount,
      name: requiredAmount === 10 ? "纸箱费" : "木箱费",
      totalQty,
      confirmed: true,
      rule: requiredAmount === 10
        ? "600*1200类纸箱10元"
        : (requiredAmount === 100 ? "600*2400类木箱100元" : "1200*2400及大板类木箱200元")
    };
  }

  function isLiujinProductName(value) {
    const text = String(value || "").replace(/\s+/g, "").toLowerCase();
    if (!text) return false;
    if (text.includes("鎏金")) return true;
    return liujinSeriesPriceGroups.some((group) => group.names.some((name) => text.includes(name.toLowerCase())));
  }

  function findLiujinSeriesPrice(productName, specKey) {
    const text = String(productName || "").replace(/\s+/g, "").toLowerCase();
    if (!text) return null;
    let bestMatch = null;
    liujinSeriesPriceGroups.forEach((group) => {
      group.names.forEach((name) => {
        const keyword = String(name || "").replace(/\s+/g, "").toLowerCase();
        if (!keyword || !text.includes(keyword)) return;
        if (!bestMatch || keyword.length > bestMatch.keywordLength) {
          bestMatch = { group, keywordLength: keyword.length };
        }
      });
    });
    if (!bestMatch) return null;
    return Object.prototype.hasOwnProperty.call(bestMatch.group.prices, specKey)
      ? bestMatch.group.prices[specKey]
      : "";
  }

  const concrete168PackagingNote = "168清水板、透光板订单总面积不足5㎡时：小板（1200*600mm）包装费100元；大板（1200*2400mm或单件面积1.5㎡以上）包装费150元。";

  function specAreaSquareMeters(value) {
    const values = String(value || "").replace(/[×xX]/g, "*").match(/\d+(?:\.\d+)?/g) || [];
    if (values.length < 2) return 0;
    return (Number(values[0]) * Number(values[1])) / 1000000;
  }

  function concrete168PackagingFee(products, totalArea) {
    const area = Number(totalArea) || 0;
    if (!(area > 0 && area < 5)) return 0;

    const items = Array.isArray(products) ? products : [];
    const packagedItems = items.filter((item) => {
      const name = String(item?.productName || "");
      return /清水|透光/.test(name) || item?.productType === "flat" || item?.productType === "cave";
    });
    let amount = 0;

    if (packagedItems.length) {
      const hasLargeBoard = packagedItems.some((item) => specAreaSquareMeters(item.specText || item.spec || "") >= 1.5);
      amount = Math.max(amount, hasLargeBoard ? 150 : 100);
    }
    return amount;
  }

  window.JieGeProductData = {
    liujinSpecs,
    liujinSeriesPriceGroups,
    sandstoneSpecs,
    concretePriceTable,
    ningboProductCatalog,
    meililaiProductCatalog,
    ningboWeightRules,
    groupedNingboCatalog,
    groupedMeililaiCatalog,
    normalizeNingboSpec,
    findNingboVariant,
    findNingboWeightProfile,
    isLiujinProductName,
    findLiujinSeriesPrice,
    concrete168PackagingNote,
    specAreaSquareMeters,
    concrete168PackagingFee,
    meililaiPackagingFee
  };
})();
