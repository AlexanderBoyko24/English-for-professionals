/* Данные урока — редактируйте только этот файл. */
window.LESSON = {
  number:  "35",
  title:   "пробник",
  vocabulary: [
    { word: "head", trans: "/hed/", ru: "голова" },
    { word: "body", trans: "/ˈbɒdi/", ru: "тело" },
    { word: "arm", trans: "/ɑːm/", ru: "рука (от плеча до кисти)" },
    { word: "leg", trans: "/leɡ/", ru: "нога (от бедра до стопы)" },
    { word: "lower leg", trans: "/ˈləʊə leɡ/", ru: "голень" },
    { word: "blood", trans: "/blʌd/", ru: "кровь" }
  ],
  translatePhrases: [
    { en: "head injury", ru: "травма головы" },
    { en: "human body", ru: "тело человека" },
    { en: "broken arm", ru: "сломанная рука" },
    { en: "long leg", ru: "длинная нога" },
    { en: "left hand", ru: "левая кисть" },
    { en: "high blood pressure", ru: "высокое кровяное давление" }
  ],
  text: [
    "The human body is an amazing and complex machine. The head sits at the top of the body and contains the brain, which controls thoughts, movements, and senses. The face is the front part of the head, and it includes two eyes for seeing, two ears for hearing, a nose for breathing and smelling, and a mouth for eating and speaking. The eyes can move in different directions, the ears have inner structures that help with balance, and the nose is connected to the lungs.",
    "All parts of the body are covered by skin, which protects internal organs from injury and infection. Bones give the body its shape and support. Without bones, the body would be soft and unable to move. Blood flows through blood vessels and carries oxygen from the lungs to every cell. The heart, lungs, brain, stomach, bones, skin, and blood work together to keep the human body alive and healthy."
  ],
  trueFalse: [
    { s: "The brain controls thoughts, movements, and senses.", correct: true },
    { s: "The nose is connected to the stomach.", correct: false },
    { s: "The heart pumps blood every minute.", correct: false },
    { s: "The lungs are located below the stomach.", correct: false },
    { s: "The shoulders connect the arms to the chest.", correct: true }
  ],
  translateToEnglish: [
    { ru: "сложная машина", en: "complex machine" },
    { ru: "содержать мозг", en: "to contain the brain" },
    { ru: "передняя часть головы", en: "the front part of the head" },
    { ru: "разные направления", en: "different directions" },
    { ru: "быть покрытым кожей", en: "to be covered by skin" }
  ],
  matching: [
    { term: "head", def: "the top part of the body that contains the brain, eyes, ears, nose, and mouth." },
    { term: "body", def: "the whole physical structure of a person or animal." },
    { term: "arm", def: "the long part of the body that connects the shoulder to the hand." },
    { term: "leg", def: "the long part of the body that connects the hip to the foot." },
    { term: "hand", def: "the end part of the arm that has fingers and a thumb." },
    { term: "lower leg", def: "the part of the leg between the knee and the ankle, also called the calf." }
  ],
  matchPicture: [
    { image: "head.png", def: "The top part of the body that contains the brain, eyes, ears, nose, and mouth.", word: "head" },
    { image: "body.png", def: "The whole physical structure of a person or animal.", word: "body" },
    { image: "trunk.png", def: "The main part of the body, not including the head, arms, and legs; also called the torso.", word: "trunk" },
    { image: "upper limb.png", def: "The whole arm, including the shoulder, upper arm, forearm, and hand.", word: "upper limb" },
    { image: "lower limb.png", def: "The whole leg, including the thigh, lower leg, and foot.", word: "lower limb" },
  ],
  mindMap: {
    center: "The Human Body",
    branches: [
      { id: "b1", label: "Main parts", answer: "head, trunk, limbs" },
      { id: "b2", label: "Major organs", answer: "heart, brain, lungs, stomach" },
      { id: "b3", label: "Skeleton includes", answer: "bones, skull, spine" },
      { id: "b4", label: "Functions", answer: "movement, protection, support" },
      { id: "b5", label: "Protects the body", answer: "skin" },
      { id: "b6", label: "Carries oxygen and nutrients", answer: "blood" },
    ],
    options: [
      "head, trunk, limbs", "heart, brain, lungs, stomach", "bones, skull, spine",
      "movement, protection, support", "skin", "blood", "muscles", "kidneys", "liver", "nerves"
    ]
  },
  logicalSequence: {
    title: "The Human Body",
    sequences: [
      {
        title: "breathing process",
        steps: [
          { position: 1, text: "air enters through the nose or mouth", fixed: true },
          { position: 2, text: "", fixed: false, answer: "air goes to the lungs"},
          { position: 3, text: "", fixed: false, answer: "oxygen carries to the organs"},
          { position: 4, text: "", fixed: false, answer: "carbon dioxide is removed" },
        ]
      },
      {
        title: "blood circulation",
        steps: [
          { position: 1, text: "the heart pumps blood", fixed: true },
          { position: 2, text: "", fixed: false, answer: "blood carries oxygen and nutrients to the organs"},
          { position: 3, text: "", fixed: false, answer: "organs work properly"},
        ]
      },
      {
        title: "digestion",
        steps: [
          { position: 1, text: "food enters the mouth", fixed: true },
          { position: 2, text: "", fixed: false, answer: "broken down food goes to the stomach"},
          { position: 3, text: "nutrients begins to absorb into the blood", fixed: true },
          { position: 4, text: "", fixed: false, answer: "nutrients convert to energy" },
        ]
      }
    ],
    options: ["air goes to the lungs", "oxygen carries to the organs", "carbon dioxide is removed", "blood carries oxygen and nutrients to the organs","organs work properly", "broken down food goes to the stomach", "nutrients convert to energy"]
  },
  labelDiagram: {
    title: "Label the Human Body",
    image: "humanbody2.png",
    markers: [
      { id: "m1", label: "1", x: 50, y: 12, answer: "brain" },
      { id: "m2", label: "2", x: 40, y: 46, answer: "lungs" },
      { id: "m3", label: "3", x: 54, y: 46, answer: "heart" },
      { id: "m4", label: "4", x: 59, y: 55, answer: "stomach" },
      { id: "m5", label: "5", x: 27, y: 44, answer: "shoulder" },
      { id: "m6", label: "6", x: 16, y: 85, answer: "hand" },
      { id: "m7", label: "7", x: 68, y: 85, answer: "leg" },
    ],
    options: ["brain", "lungs", "heart", "stomach", "shoulder", "hand", "leg"]
  },
  fillTable: {
    title: "Word Formation",
    caption: "Form the correct gerund and translate",
    columns: [
      { header: "Verb", key: "verb" },
      { header: "Gerund (V+ing)", key: "gerund" },
      { header: "Translation", key: "translation" }
    ],
    rows: [
      { verb: "breathe", gerund: "", translation: "" },
      { verb: "pump", gerund: "", translation: "" },
      { verb: "digest", gerund: "", translation: "" },
      { verb: "control", gerund: "", translation: "" },
    ],
    answers: [
      { gerund: "breathing", translation: "дыхание" },
      { gerund: "pumping", translation: "перекачивание" },
      { gerund: "digesting", translation: "переваривание" },
      { gerund: "controlling", translation: "контроль" },
    ]
  },
  fillBlanks: [
    { before: "The ___ is the top part of the body that contains the brain, eyes, ears, nose, and mouth.", answer: "head", after: "" },
    { before: "The entire physical structure of a person is called the human ___.", answer: "body", after: "" },
    { before: "The ___ connects the shoulder to the hand.", answer: "arm", after: "" },
    { before: "The lower part of the leg between the knee and the ankle is called the ___.", answer: "lower leg", after: "" },
    { before: "The outer layer of the body that protects internal organs is the ___.", answer: "skin", after: "" },
  ],
  jumble: [
    { words: ["The", "heart", "pumps", "blood", "through", "the", "body"], correct: "The heart pumps blood through the body." },
    { words: ["The", "lungs", "take", "in", "oxygen", "and", "remove", "carbon", "dioxide"], correct: "The lungs take in oxygen and remove carbon dioxide." },
    { words: ["The", "brain", "controls", "thoughts", "and", "movements"], correct: "The brain controls thoughts and movements." },
    { words: ["The", "head", "contains", "the", "brain", "eyes", "ears", "nose", "and", "mouth"], correct: "The head contains the brain, eyes, ears, nose, and mouth." },
  ],
  listeningGapFill: {
    audio: "audio/35.mp3",
    gaps: [
      { id: 1, answer: "brain", options: ["brain", "heart", "stomach", "skin", "lungs"] },
      { id: 2, answer: "heart", options: ["heart", "brain", "lungs", "blood", "stomach"] },
      { id: 3, answer: "lungs", options: ["lungs", "heart", "bones", "skin", "stomach"] },
      { id: 4, answer: "bones", options: ["bones", "skin", "blood", "brain", "shoulders"] },
      { id: 5, answer: "shoulders", options: ["shoulders", "arms", "legs", "knees", "chest"] },
      { id: 6, answer: "stomach", options: ["stomach", "heart", "lungs", "brain", "skin"] },
      { id: 7, answer: "skin", options: ["skin", "blood", "bones", "stomach", "heart"] },
      { id: 8, answer: "blood", options: ["blood", "oxygen", "heart", "skin", "bones"] }
    ],
    textTemplate: "Paragraph 1. Listen carefully. The human body has a head, a trunk, and limbs. The head contains the {1}, eyes, ears, nose, and mouth. The {1} controls everything you think and do. The chest is part of the trunk. Inside the chest, the {2} pumps blood. The {3} help you breathe. The back is also part of the trunk. It holds the spine, which is made of many small {4}. Your {5} connect your arms to your chest. Your arms end with hands. Your legs end with feet. Your knees bend when you walk or run. Paragraph 2. Now listen to the second part. Inside your body, the {6} digests food. Your {7} covers your whole body and protects it. {8} flows through your body and carries oxygen. All parts work together. From your head to your feet, from your {4} to your {8} – everything works as one system. That is why the human body is amazing."
  },
  readingPractice: {
    text: "The human body consists of three main parts: the head, the trunk (chest and back), and the limbs (arms and legs). The head contains the brain, which controls thoughts and movements. On the face we see two eyes, two ears, a nose, and a mouth. The chest houses the heart (pumps blood) and the lungs (breathe air). The back runs from the neck to the pelvis and contains the spine made of many small bones. The shoulders connect the arms (each ends with a hand), and the legs support the body. The knee bends when we walk, and the foot touches the ground.Inside the body, the stomach digests food. Skin covers everything and protects internal organs. Blood carries oxygen and nutrients to all cells. Every part — from the head to the foot, from bones to blood — works together to keep us alive and healthy.",
  },
  video: "video/35.mp4",
};
