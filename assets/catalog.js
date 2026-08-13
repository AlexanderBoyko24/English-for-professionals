/* ================================================================
   КАТАЛОГ КУРСОВ
   ----------------------------------------------------------------
   Единый источник структуры: курс → подкурс → тема.
   Им пользуются стартовая страница, кабинеты студента и
   преподавателя, страница подкурса и движок урока.

   Чтобы добавить тему: положите данные в data/<курс>/<подкурс>/N.js,
   создайте страницу <курс>/<подкурс>/N.html по образцу существующих
   и допишите тему в список topics ниже.
   ================================================================ */

window.CATALOG = {
  courses: [
    {
      key: 'medical',
      title: 'Medical English',
      desc: 'Для медицинских специальностей: анатомия, патология, акушерство, фармация.',
      icon: 'fa-heartbeat',
      theme: 'medical',
      subcourses: [
        {
          key: 'anatomy',
          title: 'Anatomy',
          emoji: '🧬',
          ready: true,
          topics: [
      { key: "1", title: "The Human Body", icon: "human_body.png" },
      { key: "2", title: "The Skeleton", icon: "skeleton.png" },
      { key: "3", title: "The SKULL", icon: "skull.png" },
      { key: "4", title: "The SPINAL COLUMN", icon: "spinal_column.png" },
      { key: "5", title: "The CHEST", icon: "chest.png" },
      { key: "6", title: "The UPPER LIMB", icon: "arm.png" },
      { key: "7", title: "The LOWER LIMB", icon: "lower_limb.png" },
      { key: "8", title: "BONES, CARTILAGES & JOINTS", icon: "joints.png" },
      { key: "9", title: "MUSCULAR SYSTEM", icon: "muscles.png" },
      { key: "10", title: "STRIATED MUSCLES", icon: "striated.png" },
      { key: "11", title: "SMOOTH MUSCLES", icon: "smooth.png" },
      { key: "12", title: "TENDONS & LIGAMENTS", icon: "tendon.png" },
      { key: "13", title: "The CARDIOVASCULAR SYSTEM", icon: "cardiovascular.png" },
      { key: "14", title: "The HEART", icon: "heart.png" },
      { key: "15", title: "The VESSELS", icon: "vessels.png" },
      { key: "16", title: "The BLOOD", icon: "blood.png" },
      { key: "17", title: "The HEART SOUNDS", icon: "heart_sounds.png" },
      { key: "18", title: "The RESPIRATORY SYSTEM", icon: "respiratory_system.png" },
      { key: "19", title: "The UPPER RESPIRATORY TRACT", icon: "LRT.png" },
      { key: "20", title: "The LOWER RESPIRATORY TRACT", icon: "URT.png" },
      { key: "21", title: "The DIGESTIVE TRACT", icon: "digestive.png" },
      { key: "22", title: "The STOMACH", icon: "stomach.png" },
      { key: "23", title: "The INTESTINES", icon: "intestines.png" },
      { key: "24", title: "The ACCESSORY ORGANS OF DIGESTION", icon: "accessory.png" },
      { key: "25", title: "The NERVOUS SYSTEM", icon: "Nervous_system.png" },
      { key: "26", title: "The BRAIN", icon: "brain.png" },
      { key: "27", title: "The SPINAL CORD AND NERVES", icon: "cord.png" },
      { key: "28", title: "The URINARY SYSTEM", icon: "urinary.png" },
      { key: "29", title: "The KIDNEYS", icon: "kidneys.png" },
      { key: "30", title: "The FEMALE REPRODUCTIVE SYSTEM", icon: "FRS.png" },
      { key: "31", title: "The MALE REPRODUCTIVE SYSTEM", icon: "MRS.png" },
      { key: "32", title: "The INTEGUMENTARY SYSTEM", icon: "skin.png" },
      { key: "33", title: "The ENDOCRINE SYSTEM", icon: "glands.png" },
      { key: "34", title: "The LYMPHATIC SYSTEM", icon: "lymphatic.png" },
      { key: "35", title: "пробник", icon: "human_body.png" }
          ]
        },
        { key: 'pathology',  title: 'Pathology',  emoji: '🩺', ready: false, topics: [] },
        { key: 'obstetrics', title: 'Obstetrics', emoji: '🤰', ready: false, topics: [] },
        { key: 'pharmacy',   title: 'Pharmacy',   emoji: '💊', ready: false, topics: [] }
      ]
    },
    {
      key: 'culinary',
      title: 'Culinary English',
      desc: 'Для поваров, кондитеров и работников общественного питания.',
      icon: 'fa-utensils',
      theme: 'chef',
      subcourses: [
        { key: 'basics',  title: 'Kitchen Basics', emoji: '🍲', ready: false, topics: [] },
        { key: 'pastry',  title: 'Pastry',         emoji: '🧁', ready: false, topics: [] }
      ]
    },
    {
      key: 'commodity',
      title: 'Commodity & Logistics',
      desc: 'Для товароведов, логистов и специалистов по снабжению.',
      icon: 'fa-boxes-stacked',
      theme: 'merch',
      subcourses: [
        { key: 'goods',    title: 'Goods & Quality', emoji: '📦', ready: false, topics: [] },
        { key: 'shipping', title: 'Shipping',        emoji: '🚚', ready: false, topics: [] }
      ]
    },
    {
      key: 'tech',
      title: 'Technical English',
      desc: 'Для инженеров, техников и специалистов по оборудованию.',
      icon: 'fa-microchip',
      theme: 'tech',
      subcourses: [
        { key: 'mechanics',  title: 'Mechanics',  emoji: '⚙️', ready: false, topics: [] },
        { key: 'electrical', title: 'Electrical', emoji: '🔌', ready: false, topics: [] }
      ]
    },
    {
      key: 'business',
      title: 'Business English',
      desc: 'Переговоры, переписка, презентации и деловая документация.',
      icon: 'fa-chart-line',
      theme: 'business',
      subcourses: [
        { key: 'correspondence', title: 'Correspondence', emoji: '✉️', ready: false, topics: [] },
        { key: 'negotiations',   title: 'Negotiations',   emoji: '🤝', ready: false, topics: [] }
      ]
    },
    {
      key: 'law',
      title: 'Legal English',
      desc: 'Для юристов: договоры, судопроизводство, юридическая лексика.',
      icon: 'fa-scale-balanced',
      theme: 'law',
      subcourses: [
        { key: 'contracts',  title: 'Contracts',  emoji: '📜', ready: false, topics: [] },
        { key: 'litigation', title: 'Litigation', emoji: '⚖️', ready: false, topics: [] }
      ]
    }
  ]
};

/* ---------------- вспомогательные функции ---------------- */

window.CATALOG.findCourse = function (courseKey) {
  return window.CATALOG.courses.filter(function (c) { return c.key === courseKey; })[0] || null;
};

window.CATALOG.findSubcourse = function (courseKey, subKey) {
  var course = window.CATALOG.findCourse(courseKey);
  if (!course) return null;
  return course.subcourses.filter(function (s) { return s.key === subKey; })[0] || null;
};

window.CATALOG.findTopic = function (courseKey, subKey, topicKey) {
  var sub = window.CATALOG.findSubcourse(courseKey, subKey);
  if (!sub) return null;
  return sub.topics.filter(function (t) { return t.key === String(topicKey); })[0] || null;
};

/* Ключ прогресса темы: 'medical/anatomy/1'. */
window.CATALOG.topicKey = function (courseKey, subKey, topicKey) {
  return courseKey + '/' + subKey + '/' + topicKey;
};

/* Все готовые подкурсы — для кабинетов студента и преподавателя. */
window.CATALOG.readySubcourses = function () {
  var out = [];
  window.CATALOG.courses.forEach(function (course) {
    course.subcourses.forEach(function (sub) {
      if (sub.ready && sub.topics.length) out.push({ course: course, sub: sub });
    });
  });
  return out;
};
