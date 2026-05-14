export const MENU = [
  {
    id: "hot_drinks",
    name: "Topli napici",
    emoji: "☕",
    subcategories: [
      {
        id: "espresso",
        name: "Espresso",
        items: [
          { id: "espresso5", name: "Obični", price: 3 },
          { id: "espresso2", name: "Kratki", price: 3 },
          { id: "espresso9", name: "Kratki s hladnim", price: 3 },
          { id: "espresso1", name: "Dupli", price: 6 },
          { id: "espresso3", name: "Sa slagom", price: 4.5 },
          { id: "espresso4", name: "Produženi", price: 3 },
          { id: "espresso6", name: "Duži u malu", price: 3 },
          { id: "espresso7", name: "Mala s hladnim", price: 3.5 },
          { id: "espresso8", name: "Velika s hladnim", price: 3.5 },
        ],
      },
      {
        id: "makijato",
        name: "Makijato",
        items: [
          { id: "makijato1", name: "Veliki", price: 3.5 },
          { id: "makijato2", name: "Mali", price: 3.5 },
          { id: "makijato3", name: "Bez pjene", price: 3.5 },
          { id: "makijato4", name: "Zaimova", price: 3.5 },
          { id: "makijato5", name: "Staklena Zaimova", price: 4.5 },
          { id: "makijato6", name: "Stakleni Makijato", price: 4.5 },
        ],
      },
      {
        id: "ness",
        name: "Ness",
        items: [
          { id: "ness1", name: "Čokolada", price: 4.5 },
          { id: "ness2", name: "Vanilija", price: 4.5 },
          { id: "ness3", name: "Klasik", price: 4.5 },
        ],
      },
      {
        id: "kapucino",
        name: "Kapucino",
        items: [
          { id: "kapucino1", name: "Čokolada", price: 4.5 },
          { id: "kapucino2", name: "Vanilija", price: 4.5 },
          { id: "kapucino3", name: "Klasik", price: 4.5 },
        ],
      },
      {
        id: "bosnian",
        name: "Bosanska",
        emoji: "🫖",
        items: [
          { id: "bos2", name: "Obična", price: 3.5 },
          { id: "bos1", name: "Dupla", price: 7 },
        ],
      },
      {
        id: "hot_chocolate",
        name: "Topla čokolada",
        items: [
          { id: "choc1", name: "Obična", price: 4.5 },
          { id: "choc2", name: "Bijela", price: 4.5 },
          { id: "choc3", name: "Crna", price: 4.5 },
          { id: "choc4", name: "Lješnjak", price: 4.5 },
          { id: "choc5", name: "Jagoda", price: 4.5 },
          { id: "choc6", name: "Kokos", price: 4.5 },
          { id: "choc7", name: "Tiramisu", price: 4.5 },
        ],
      },
      {
        id: "ostalo",
        name: "Ostalo",
        items: [
          { id: "ostalo1", name: "Salep", price: 4.5 },
          { id: "ostalo2", name: "Latte", price: 4.5 },
          { id: "ostalo3", name: "Amerikano", price: 4.5 },
          { id: "ostalo4", name: "Frape", price: 6.5 },
        ],
      },
    ],
  },
  {
    id: "tea",
    name: "Čaj",
    emoji: "🍵",
    subcategories: [
      {
        id: "tea_varieties",
        name: "Čajevi",
        items: [
          { id: "tea8", name: "Turski", price: 3 },
          { id: "tea11", name: "Veliki turski čaj", price: 5 },
          { id: "tea10", name: "Ibrik", price: 6 },
          { id: "tea4", name: "Kivi", price: 3 },
          { id: "tea6", name: "Nar", price: 3 },
          { id: "tea7", name: "Jabuka", price: 3 },
          { id: "tea16", name: "Zeleni caj", price: 3 },
          { id: "tea1", name: "Kamilica", price: 3 },
          { id: "tea2", name: "Brusnica", price: 3 },
          { id: "tea3", name: "Đumbir", price: 3 },
          { id: "tea5", name: "Menta", price: 3 },
          { id: "tea9", name: "Majčina dušica", price: 3 },
          { id: "tea12", name: "Indijski", price: 3 },
          { id: "tea13", name: "Voćni", price: 3 },
          { id: "tea14", name: "Jagoda vanilija", price: 3 },
          { id: "tea15", name: "Jabuka cimet", price: 3 },
        ],
      },
    ],
  },
  {
    id: "non_alcoholic_drinks",
    name: "Pića",
    emoji: "🥤",
    subcategories: [
      {
        id: "non_sparkling",
        name: "Negazirana",
        items: [
          { id: "non1", name: "Limunada", price: 4.5 },
          { id: "non2", name: "Cijedjena narandža", price: 4.5 },
          { id: "non3", name: "Cedevita", price: 4.5 },
          { id: "non4", name: "Ledeni čaj", price: 4.5 },
          { id: "non5", name: "Red Bull", price: 4.5 },
          { id: "water1", name: "Flasirana voda", price: 3.5 },
          { id: "water3", name: "Kisela voda", price: 3.5 },
          { id: "non6", name: "ACE", price: 4.5 },
        ],
      },

      {
        id: "sparkling",
        name: "Gazirana",
        items: [
          { id: "spark6", name: "Coca cola", price: 5.5 },
          { id: "spark7", name: "Coca cola zero", price: 5.5 },
          { id: "spark2", name: "Cocta", price: 3.5 },
          { id: "spark8", name: "Fanta", price: 5.5 },
          { id: "spark9", name: "Sprite", price: 5.5 },
          { id: "spark13", name: "Orangina", price: 5.5 },
          { id: "spark1", name: "Spezi", price: 4.5 },
          { id: "spark3", name: "Exotic", price: 4 },
          { id: "spark10", name: "Bitter Lemon Schweps", price: 5.5 },
          { id: "spark11", name: "Tonik Schweps", price: 5.5 },
          { id: "spark12", name: "Tangerina Schweps", price: 5.5 },
          { id: "spark14", name: "Limona", price: 4.5 },
          { id: "spark4", name: "Mineralna voda", price: 3.5 },
          { id: "spark5", name: "Prirodna voda", price: 3.5 },
        ],
      },
      {
        id: "juice",
        name: "Gusti sokovi",
        items: [
          { id: "juice1", name: "Aronija", price: 4.5 },
          { id: "juice2", name: "Ananas", price: 4.5 },
          { id: "juice3", name: "Jagoda", price: 4.5 },
          { id: "juice4", name: "Jabuka", price: 4.5 },
          { id: "juice5", name: "Naranča", price: 4.5 },
          { id: "juice6", name: "Breskva", price: 4.5 },
        ],
      },
    ],
  },
  {
    id: "cakes",
    name: "Kolači",
    emoji: "🍰",
    subcategories: [
      {
        id: "cakes_varieties",
        name: "Kolači",
        items: [
          { id: "cake1", name: "Kadaif", price: 4.5 },
          { id: "cake2", name: "Trileća", price: 4.5 },
          { id: "cake3", name: "Hurmašica", price: 4.5 },
          { id: "cake4", name: "Baklava", price: 4.5 },
        ],
      },
    ],
  },
  {
    id: "glass",
    name: "Casa",
    emoji: "🥛",
    subcategories: [
      {
        id: "glass_varieties",
        name: "Casa",
        items: [
          { id: "glass1", name: "Casa vode viška", price: 0 },
          { id: "glass2", name: "Casa", price: 0 },
        ],
      },
    ],
  },
//   {
//     id: "hot_chocolate",
//     name: "Topla čokolada",
//     emoji: "🍫",
//     subcategories: [
//       {
//         id: "hot_chocolate_varieties",
//         name: "Čokolade",
//         items: [
//           { id: "choc1", name: "Obična", price: 3 },
//           { id: "choc2", name: "Bijela", price: 3.5 },
//           { id: "choc3", name: "Crna", price: 3 },
//           { id: "choc4", name: "Lješnjak", price: 4 },
//           { id: "choc5", name: "Jagoda", price: 3.5 },
//           { id: "choc6", name: "Kokos", price: 3.5 },
//           { id: "choc7", name: "Tiramisu", price: 4 },
//         ],
//       },
//     ],
//   },
 
];
