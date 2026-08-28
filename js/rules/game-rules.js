/* ═══════════════════════════════════════════
   Digital Moroccan casino — Game Rules & Tutorial System
   ═══════════════════════════════════════════ */
"use strict";
/* ── قاعدة بيانات القواعد الكاملة ── */
var FULL_RULES = {
  /* ═══ Moroccan Ronda ♦️♠️ ═══ */
    /* ═══ Moroccan Rami (Talaj & Simple) ═══ */
  rm: {
    name: {
      ar: 'الرامي المغربي (طلاح + سامبل) 🃏',
      da: 'الرامي المغربي (طالاج وسامبل) 🃏',
      fr: 'Rami Marocain (Talaj + Sample) 🃏',
      en: 'Moroccan Rami (Talaj + Sample) 🃏'
    },
    goal: {
      ar: 'كوّن مجموعات (متماثلات ومتتاليات) وأنزلها في الطاولة، وأنهِ الشوط بأقل مجموع نقاط، وتجنّب تجاوز هدف الجولة (501–1001) لتبقى الفائز.',
      da: 'جمع المجموعات (متشابهات وتسلسلات) ونزلها فالطبلة، وسالي الشوط بأقل مجموع نقاط، وتجنب تفوت هدف الجولة (501–1001) باش تبقى رابح.',
      fr: 'Formez des combinaisons (brelans et suites), posez-les sur la table et finissez la manche avec le moins de points possible, sans dépasser l\'objectif de la partie (501–1001).',
      en: 'Form melds (sets and sequences), lay them on the table, and finish each round with the lowest score, avoiding exceeding the match target (501–1001) to remain the winner.'
    },
    steps: {
      ar: [
        'اختر الوضع: طلاح (108 أوراق + 4 جوكر) أو سامبل (104 أوراق بجوكر معكوس اللون)',
        'التوزيع: 14 ورقة لكل لاعب و15 للموزع في الطلاح (13 لكل لاعب في السامبل)؛ أول موزع = صاحب أصغر ورقة',
        'في دورك (مؤقت 90 ثانية): اسحب ورقة واحدة بالضبط من المجرف أو خذ ورقة المرموق، ثم ارمِ ورقة واحدة بالضبط (اليد 14 بين الأدوار و15 أثناء الدور)',
        'الافتتاح: متماثلة ≥3 + متتالية ≥3 ومجموع ≥ 71 نقطة في الطلاح (≥ 51 في السامبل) بدون جوكر في الحساب',
        'بعد الافتتاح: أضف الأوراق الصالحة لأي مجموعة ظاهرة (له أو لغيره) أو استبدل الجوكر بورقة من يدك',
        'الإنهاء: 14 ورقة كلها مجموعات صالحة + الورقة الـ15 تُقلب ظهراً على الطاولة (في السامبل: 13 مجموعة + الـ14 ظهراً)'
      ],
      da: [
        'عزل الوضع: طالاج (108 ورقة + 4 جوكير) ولا سامبل (104 ورقة بجوكر معكوس)',
        'التوزيع: 14 ورقة لكل لعاب و15 للموزع فالطالاج (13 لكل واحد فالسامبل)',
        'فدورك (90 ثانية): جبد ورقة وحدة بالضبط من الباكي ولا خود المرموق، وارمي ورقة وحدة بالضبط',
        'الافتتاح: مجموعة متشابهة ≥3 + تسلسل ≥3 والمجموع ≥ 71 فالطالاج (≥ 51 فالسامبل) بلا جوكر فالحساب',
        'من بعد الافتتاح: زيد الأوراق الصالحة لأي مجموعة ظاهرة ولا بدل الجوكر بورقة من يدك',
        'الإنهاء: 14 ورقة كلها مجموعات صالحة + الورقة 15 تنقلب على ضهرها'
      ],
      fr: [
        'Choisissez le mode : Talaj (108 cartes + 4 jokers) ou Sample (104 cartes avec joker de couleur inversée)',
        'Distribution : 14 cartes par joueur et 15 au donneur en Talaj (13 chacun en Sample) ; le premier donneur est celui qui détient la plus petite carte',
        'À votre tour (90 s) : piochez exactement une carte (talon ou défausse) puis défaussez exactement une carte (14 cartes entre les tours, 15 pendant le tour)',
        'Ouverture : brelan ≥3 + suite ≥3 et total strictement supérieur à 71 en Talaj (51 en Sample), sans joker dans le compte',
        'Après l\'ouverture : ajoutez les cartes valides à toute combinaison exposée (la vôtre ou celle d\'un adversaire) ou remplacez un joker par une carte de votre main',
        'Fin de manche : 14 cartes toutes en combinaisons valides + la 15e posée face cachée (en Sample : 13 combinaisons + la 14e face cachée)'
      ],
      en: [
        'Choose the mode: Talaj (108 cards + 4 Jokers) or Sample (104 cards with a colour-reversed Joker)',
        'Deal: 14 cards per player and 15 to the dealer in Talaj (13 each in Sample); the first dealer is the holder of the lowest card',
        'On your turn (90s timer): draw exactly one card (stock or discard) then discard exactly one (14 cards between turns, 15 during the turn)',
        'Opening: Set ≥3 + Sequence ≥3 and a total ≥ 71 in Talaj (≥ 51 in Sample), excluding Jokers from the count',
        'After opening: add valid cards to any exposed meld (yours or an opponent\'s) or replace a Joker with one card from your hand',
        'Finish: all 14 cards form valid melds + the 15th card placed face-down (in Sample: 13 melds + the 14th face-down)'
      ]
    },
    details: {
      ar: [
        { h: 'تعريفات عامة', items: [
          'الرموز: قلب/مربع (أحمر)، سيف/عنب (أسود). قيم الافتتاح: الرقم = قيمته؛ J/Q/K/A = 10.',
          'متماثلة (Set): 3 أوراق أو أكثر بنفس العدد وبرموز مختلفة، بلا تكرار رمز داخل المجموعة.',
          'متتالية (Sequence): 3 أوراق أو أكثر متتابعة بنفس الرمز.',
          'المجرف = أوراق السحب؛ المرموق = أوراق الرمي.'
        ]},
        { h: 'قانون الطلاح — التوزيع والدور', items: [
          '2–5 لاعبين؛ 108 أوراق (8 لكل رقم + 4 جوكر). أول موزع = صاحب أصغر ورقة، والتعاقب يميناً كل شوط.',
          '14 ورقة لكل لاعب و15 للموزع؛ يرمي الموزع أول ورقة لبدء المرموق.',
          'الدور: سحب واحد (مجرف أو مرموق) ثم رمي واحد بالضبط؛ اليد 14 بين الأدوار و15 أثناء الدور — مستحيل 13 أو 16.',
          'مؤقت 90 ثانية؛ عند انتهائه لعب أوتوماتيكي وتمرير الدور.'
        ]},
        { h: 'قانون الطلاح — الافتتاح (الإظهار)', items: [
          'شرطان معاً: متماثلة ≥3 + متتالية ≥3، ومجموع الأوراق المُظهرة ≥ 71 (بالحساب الوجهي) دون جوكر في الحساب.',
          'إن وُجد افتتاح سابق: يجب تجاوز مجموع آخر مُظهِر.',
          'ورقة الموزع الأولى تُؤخذ فقط في حالتين: إكمال افتتاحٍ مستوفٍ، أو إنهاء الشوط كاملاً.',
          'إظهار بدون شروط = +71، تُجمع الأوراق ويُرمى ورقة ويستمر الشوط.',
          'أخذ ورقة (مرموق/سابقة) دون شروط = +71 مع إرجاع الورقة.'
        ]},
        { h: 'قانون الطلاح — الإضافة واستبدال الجوكر', items: [
          'بعد تحقق الشروط يجوز إنقاص ورقة من اليد بإضافتها لأي مجموعة ظاهرة (له أو لغيره) بشرط التجانس وعدم التكرار: متتالية ← نفس الرمز وتمدد التسلسل؛ متماثلة ← نفس العدد برمز غير موجود.',
          'استبدال الجوكر: ورقة واحدة من اليد تُضاف للمجموعة أو يُستبدل بها الجوكر فيها.',
          'كل ورقة صالحة تُقبل، وغير الصالحة تُرفض فقط، برسالة واحدة غير مكررة.'
        ]},
        { h: 'قانون الطلاح — إنهاء الشوط', items: [
          'حالة أ (أساسية): 14 ورقة كلها مجموعات صالحة (الجوكر مسموح للتكملة) + الورقة الـ15 تُقلب ظهراً → إنهاء بدون أي شرط نقاط.',
          'حالة ب: سحب المرموق ثم الإنهاء كحالة أ → بدون شرط افتتاح.',
          'حالة ج: سحب المرموق + الإنهاء مع إضافة ورقة لمجموعة لاعبٍ منزِلٍ قبله → يلزم الافتتاح وتجاوز مجموع آخر منزِل.',
          'يمنع ظهور خطأ «شروط الافتتاح» في الحالتين أ/ب.',
          'شوط مضاعف: إن أنهى الفائز بجوكر حر معزول كالورقة الـ15 (جوكر مسحوب من ورق التوزيع، لا من المرموق أو لا تور) تُضاعف نقاط الأوراق المتبقية/اليد الكاملة على الخاسرين، دون مضاعفة جزاء الخطأ.'
        ]},
        { h: 'قانون الطلاح — قاعدة الـ12 ورقة', items: [
          'من أنزل 12 ورقة: يلزمه في دوره التالي أخذ ورقة السابق إن انتمت لأي مجموعة ظاهرة؛ غفل وسحب من المجرف = +71 نهاية الشوط (ويُعفى الرامي).',
          'من بيده كاملة: يمنع أن يرمي ورقة منتمية لمجموعة ظاهرة والتالي صاحب 12 ورقة؛ فعلها وأخذها التالي = +71 على الرامي.'
        ]},
        { h: 'قانون الطلاح — النفاد والحساب والنهاية', items: [
          'نفاد المجرف: يُخلط المرموق فقط (لا تُمس مجموعات اللاعبين) ويُستأنف عند من توقف عنده الدور.',
          'حساب نهاية الشوط: يد كاملة دون إنزال = +100؛ أنزل بعضاً = كل ورقة متبقية 10 نقاط ثابتة بغضّ النظر عن رقمها.',
          'الجزاءات تُضاف للمجموع التراكمي وتُعرض بسببها مرة واحدة.',
          'نهاية الجولة: الهدف (501–1001)؛ يخسر من يتجاوز مجموعه التراكمي الهدف، والفائز من بقي دونه؛ لا تُعلن النهاية قبل التجاوز.'
        ]},
        { h: 'قانون السامبل (104 أوراق)', items: [
          'بلا جوكر؛ تُقلب أول ورقة: إن حمراء فجوكرها السوداء بنفس الرقم، والعكس.',
          '13 ورقة لكل لاعب (والموزع)؛ الإنهاء = 13 في مجموعات + الـ14 ظهراً.',
          'الافتتاح: متماثلة + متتالية ومجموع ≥ 51 بلا جوكر؛ وما بعده يتجاوز آخر مُظهِر.',
          'عند الإنهاء يكشف الجميع: من لا يملك متماثلة + متتالية (بدون ورقة الجوكر المعينة) = +51؛ ومن يملكهما تُحسب أوراقه المتبقية بقيمتها الوجهية (J/Q/K/A وورقة الجوكر = 10)؛ إن تجاوزت 51 = +51.',
          'خطأ الإظهار/الأخذ = +51 مع جمع المجموعات واستمرار الشوط.'
        ]}
      ],
      en: [
        { h: 'General Definitions', items: [
          'Suits: Hearts/Diamonds (Red), Spades/Clubs (Black). Opening values: number cards = face value; J/Q/K/A = 10.',
          'Set: 3 or more cards of the same rank with different suits; no duplicate suits within the set.',
          'Sequence: 3 or more consecutive cards of the same suit.',
          'Stock = draw pile; Discard pile = discard pile.'
        ]},
        { h: 'Talaj — Dealing and Turn', items: [
          '2–5 players; 108 cards (8 per rank + 4 Jokers). First dealer = player holding the lowest card; deal rotates to the right each round.',
          '14 cards per player, 15 for the dealer; the dealer discards first to start the discard pile.',
          'Turn: draw exactly one card (stock or discard) then discard exactly one; hand size is 14 between turns and 15 during the turn — 13 or 16 is impossible.',
          '90-second timer; on timeout, auto-play executes and the turn passes.'
        ]},
        { h: 'Talaj — Opening (Melding)', items: [
          'Both conditions required: Set ≥3 + Sequence ≥3, and the total face value of melded cards is ≥ 71, excluding Jokers from the calculation.',
          'If a prior opening exists: you must exceed the last opener\'s total.',
          'The dealer\'s first discarded card may only be taken to complete a valid opening or to end the round entirely.',
          'Showing without conditions = +71: cards are collected, one is discarded, and the round continues.',
          'Taking a card (discard/previous) without conditions = +71 with the card returned.'
        ]},
        { h: 'Talaj — Adding to Melds & Joker Replacement', items: [
          'After meeting conditions, you may reduce your hand by adding a card to any exposed meld (yours or an opponent\'s) provided it fits legally without duplication: Sequence ← same suit extending the run; Set ← same rank with a suit not already present.',
          'Joker replacement: one card from hand is either added to the meld OR used to replace a Joker within it.',
          'All valid cards must be accepted; only invalid cards rejected — with a single, non-repeating message.'
        ]},
        { h: 'Talaj — Ending the Round', items: [
          'Case A (Standard): all 14 cards form valid melds (Jokers allowed as wildcards) + the 15th card placed face-down → ends the round with no point requirement.',
          'Case B: draw from the discard pile then end as in Case A → no opening requirement.',
          'Case C: draw from the discard pile + end by adding a card to a previous player\'s meld → must meet opening conditions AND exceed the last opener\'s total.',
          'The "opening conditions" error must NOT trigger in Cases A/B.',
          'Doubled round: if the winner ends with a free isolated Joker as the 15th card (a Joker drawn from the draw pile, not from the discard pile or La Tour), the losers\' remaining-card / full-hand points are doubled, while violation penalties are NOT doubled.'
        ]},
        { h: 'Talaj — 12-Card Rule', items: [
          'A player who has laid down 12 cards MUST take the previous player\'s discard on their next turn if it belongs to any exposed meld; failure (drawing from stock instead) = +71 at round end (the thrower is exempt).',
          'A player with a full hand MAY NOT discard a card belonging to an exposed meld when the next player holds 12 cards; violation + next player takes it = +71 on the thrower.'
        ]},
        { h: 'Talaj — Exhaustion, Scoring and Match End', items: [
          'Stock exhaustion: reshuffle the discard pile ONLY (players\' melds untouched); resume from the current turn position.',
          'End-of-round scoring: full hand without laying down = +100; partial lay-down = each remaining card is a flat 10 points, regardless of rank.',
          'Penalties are added to the cumulative score and displayed once with reason.',
          'Match end: target (501–1001); a player loses upon exceeding the target cumulative score; the winner stays below it; the game does NOT end before the threshold breach.'
        ]},
        { h: 'Sample Rules (104 Cards)', items: [
          'No Jokers; flip the first card: if red, its black counterpart of the same rank becomes the Joker, and vice versa.',
          '13 cards per player (including the dealer); win condition = 13 cards in melds + the 14th placed face-down.',
          'Opening: Set + Sequence totaling ≥ 51 excluding Jokers; subsequent openers must exceed the last opener\'s total.',
          'At round end all hands are revealed: players lacking Set + Sequence (excluding the designated Joker card) = +51; those having both count remaining cards at face value (J/Q/K/A & the Joker = 10); if the total exceeds 51 = +51.',
          'Invalid meld/take attempt = +51: melds are collected and the round continues.'
        ]}
      ],
      fr: [
        { h: 'Définitions générales', items: [
          'Symboles : Cœur/Carreau (rouge), Épée/Trèfle (noir). Valeurs d\'ouverture : chiffre = valeur ; V/D/R/As = 10.',
          'Brelan (Set) : 3 cartes ou plus de même rang avec des symboles différents, sans doublon de symbole.',
          'Suite (Sequence) : 3 cartes consécutives ou plus de même symbole.',
          'Talon = pioche ; Défausse = pile de défausse.'
        ]},
        { h: 'Talaj — Distribution et tour', items: [
          '2–5 joueurs ; 108 cartes (8 par rang + 4 jokers). Premier donneur = plus petite carte ; rotation à droite chaque manche.',
          '14 cartes par joueur, 15 au donneur ; le donneur défausse en premier.',
          'Tour : piocher exactement une carte puis défausser exactement une carte ; 14 cartes entre les tours, 15 pendant le tour — 13 ou 16 impossible.',
          'Minuteur 90 s ; à expiration, jeu automatique et passage du tour.'
        ]},
        { h: 'Talaj — Ouverture', items: [
          'Deux conditions : brelan ≥3 + suite ≥3, et total ≥ 71 (sans joker dans le compte).',
          'Si une ouverture existe : dépasser le total du dernier ouvreur.',
          'La première défausse du donneur ne se prend que pour compléter une ouverture valide ou pour finir la manche.',
          'Montrer sans conditions = +71 (cartes reprises, une défaussée, la manche continue).',
          'Prendre une carte sans conditions = +71 avec la carte rendue.'
        ]},
        { h: 'Talaj — Ajouts et joker', items: [
          'Après conditions : ajouter une carte à toute combinaison exposée si elle convient sans doublon (suite ← même symbole ; brelan ← même rang, symbole absent).',
          'Joker : une carte de la main est ajoutée OU remplace un joker.',
          'Toute carte valide est acceptée ; seule l\'invalide est rejetée, avec un message unique.'
        ]},
        { h: 'Talaj — Fin de manche', items: [
          'Cas A : 14 cartes en combinaisons valides (jokers permis) + la 15e face cachée → fin sans condition de points.',
          'Cas B : prise de la défausse puis fin comme Cas A → sans condition d\'ouverture.',
          'Cas C : prise de la défausse + fin en ajoutant à la combinaison d\'un joueur précédent → conditions d\'ouverture + dépasser le total du dernier ouvreur.',
          'L\'erreur « conditions d\'ouverture » ne doit PAS apparaître dans les cas A/B.'
        ]},
        { h: 'Talaj — Règle des 12 cartes', items: [
          'Un joueur ayant posé 12 cartes DOIT prendre la défausse du précédent si elle appartient à une combinaison exposée ; sinon +71 (le lanceur est exempté).',
          'Un joueur à main pleine ne PEUT PAS défausser une carte appartenant à une combinaison exposée si le suivant a 12 cartes ; violation + prise = +71 au lanceur.'
        ]},
        { h: 'Talaj — Épuisement, score et fin', items: [
          'Épuisement du talon : mélanger la défausse SEULEMENT (les combinaisons restent intactes).',
          'Score de fin : main pleine sans pose = +100 ; pose partielle = 10 points fixes par carte restante.',
          'Les pénalités s\'ajoutent au cumul et s\'affichent une fois avec leur raison.',
          'Fin de partie : objectif (501–1001) ; on perd en dépassant le cumul ; le gagnant reste en dessous ; pas de fin avant dépassement.'
        ]},
        { h: 'Sample (104 cartes)', items: [
          'Sans joker ; la première carte retournée désigne le joker (contrepartie de couleur inversée).',
          '13 cartes par joueur ; fin = 13 en combinaisons + la 14e face cachée.',
          'Ouverture : brelan + suite, total ≥ 51 sans joker ; ensuite dépasser le dernier ouvreur.',
          'À la fin, révélation : sans brelan + suite (hors joker désigné) = +51 ; sinon cartes restantes à leur valeur faciale (V/D/R/As et joker = 10) ; si > 51 = +51.',
          'Erreur de pose/prise = +51, combinaisons reprises, la manche continue.'
        ]}
      ],
      da: [
        { h: 'تعريفات عامة', items: [
          'الرموز: قلب/مربع حمر، سيف/عنب كحل. قيم الافتتاح: الرقم بقيمتو؛ J/Q/K/A = 10.',
          'مجموعة متشابهة: 3 أوراق ولا كتر بنفس العدد وبرموز مختلفة بلا تكرار.',
          'تسلسل: 3 أوراق ولا كتر متتابعين بنفس الرمز.',
          'الباكي = أوراق السحب؛ المرموق = أوراق الرمي.'
        ]},
        { h: 'الطلاح — التوزيع والدور', items: [
          '2–5 لعابا؛ 108 ورقة. أول موزع = صاحب أصغر ورقة؛ الدور يمشي لليمين.',
          '14 ورقة لكل لعاب و15 للموزع؛ الموزع يرمي اللولة.',
          'الدور: جبد ورقة وحدة (باكي ولا مرموق) وارمي ورقة وحدة بالضبط؛ اليد 14 بين الأدوار و15 فالدور.',
          '90 ثانية؛ ملي يسالي الوقت كيلعب الأوتوماتيك.'
        ]},
        { h: 'الطلاح — الافتتاح', items: [
          'جوج شروط: متشابهة ≥3 + تسلسل ≥3 والمجموع ≥ 71 بلا جوكر فالحساب.',
          'إلا كان افتتاح قبل: خاصك تفوت مجموع آخر مظهر.',
          'ورقة الموزع اللولة كتاخذ غير باش تكمل افتتاح ولا تسالي الشوط.',
          'إظهار بلا شروط = +71.',
          'أخذ ورقة بلا شروط = +71 وترجع الورقة.'
        ]},
        { h: 'الطلاح — الإضافة والجوكر', items: [
          'من بعد الشروط: زيد ورقة لأي مجموعة ظاهرة إلا جات قانونية بلا تكرار.',
          'الجوكر: ورقة وحدة من اليد كتزاد ولا كتتبدل بيه الجوكر.',
          'كل ورقة صالحة كتقبل وغير الصالحة كترفض برسالة وحدة.'
        ]},
        { h: 'الطلاح — إنهاء الشوط', items: [
          'حالة أ: 14 ورقة كلها مجموعات صالحة + الورقة 15 على ضهرها = ساليتي بلا شرط نقاط.',
          'حالة ب: جبدتي المرموق وساليتي = بلا شرط افتتاح.',
          'حالة ج: جبدتي المرموق وساليتي بزيادة ورقة لمجموعة لعاب آخر = خاصك الافتتاح وتفوت مجموع آخر منزل.',
          'ما كيبانش خطأ الافتتاح فالحالتين أ/ب.'
        ]},
        { h: 'الطلاح — قاعدة الـ12', items: [
          'لي نزل 12 ورقة خاصو ياخد ورقة السابق إلا كانت كتسالي مجموعة ظاهرة؛ غفل = +71.',
          'لي عندو يد كاملة ممنوع يرمي ورقة كتسالي مجموعة والتالي عندو 12؛ دارها = +71 عليه.'
        ]},
        { h: 'الطلاح — النفاد والحساب والنهاية', items: [
          'نفاد الباكي: تخبل المرموق غير، والمجموعات ما كتتمسش.',
          'حساب نهاية الشوط: يد كاملة بلا إنزال = +100؛ نزل شوية = كل ورقة متبقية 10 نقاط ثابتة.',
          'الجزاءات كتزيد للمجموع التراكمي وكتعرض مرة وحدة بالسبب.',
          'نهاية الجولة: الهدف (501–1001)؛ لي فوت التراكمي ديالو الهدف خسر، والرابح لي بقى تحتو.'
        ]},
        { h: 'السامبل (104 ورقة)', items: [
          'بلا جوكر؛ الورقة اللولة لي تنقلب كتعين الجوكر باللون المعكوس.',
          '13 ورقة لكل لعاب؛ الإنهاء = 13 مجموعة + الورقة 14 على ضهرها.',
          'الافتتاح: متشابهة + تسلسل والمجموع ≥ 51 بلا جوكر.',
          'فالآخر كيكشفو الكل: بلا متشابهة + تسلسل = +51؛ اللي عندو بجوج كيتحسبو أوراقو بقيمتهم (J/Q/K/A والجوكر = 10)؛ إلا فاتو 51 = +51.',
          'خطأ الإظهار/الأخذ = +51.'
        ]}
      ]
    },
    payouts: {
      ar: '<tr><td>إنهاء الشوط (Finish)</td><td>0 نقطة جزاء (الفوز بالشوط)</td></tr><tr><td>إظهار/افتتاح خاطئ — طلاح</td><td>+71 نقطة جزاء</td></tr><tr><td>إظهار/افتتاح خاطئ — سامبل</td><td>+51 نقطة جزاء</td></tr><tr><td>أخذ ورقة دون شروط — طلاح</td><td>+71 (مع إرجاع الورقة)</td></tr><tr><td>أخذ ورقة دون شروط — سامبل</td><td>+51</td></tr><tr><td>مخالفة قاعدة الـ12 ورقة</td><td>+71</td></tr><tr><td>يد كاملة دون إنزال — طلاح</td><td>+100</td></tr><tr><td>يد كاملة دون إنزال — سامبل</td><td>+51</td></tr><tr><td>أوراق متبقية بعد إنزال جزئي — طلاح</td><td>10 نقاط ثابتة لكل ورقة</td></tr><tr><td>أوراق متبقية بعد إنزال جزئي — سامبل</td><td>قيمتها الوجهية (J/Q/K/A والجوكر = 10)</td></tr><tr><td>شوط مضاعف (إنهاء بجوكر حر معزول)</td><td>نقاط الأوراق المتبقية/اليد الكاملة ×2 (الجزاءات لا تُضاعف)</td></tr>',
      da: '<tr><td>إنهاء الشوط</td><td>0 نقطة جزاء (ربحتي الشوط)</td></tr><tr><td>إظهار خاطئ — طالاج</td><td>+71</td></tr><tr><td>إظهار خاطئ — سامبل</td><td>+51</td></tr><tr><td>أخذ ورقة بلا شروط — طالاج</td><td>+71 (وترجع الورقة)</td></tr><tr><td>أخذ ورقة بلا شروط — سامبل</td><td>+51</td></tr><tr><td>قاعدة الـ12</td><td>+71</td></tr><tr><td>يد كاملة بلا إنزال — طالاج</td><td>+100</td></tr><tr><td>يد كاملة بلا إنزال — سامبل</td><td>+51</td></tr><tr><td>أوراق متبقية — طالاج</td><td>10 ثابتة لكل ورقة</td></tr><tr><td>أوراق متبقية — سامبل</td><td>قيمتها الوجهية (J/Q/K/A والجوكر = 10)</td></tr>',
      fr: '<tr><td>Finir la manche</td><td>0 point de pénalité (victoire)</td></tr><tr><td>Ouverture invalide — Talaj</td><td>+71 points</td></tr><tr><td>Ouverture invalide — Sample</td><td>+51 points</td></tr><tr><td>Prise de carte sans conditions — Talaj</td><td>+71 (carte rendue)</td></tr><tr><td>Prise de carte sans conditions — Sample</td><td>+51</td></tr><tr><td>Violation de la règle des 12 cartes</td><td>+71</td></tr><tr><td>Main pleine sans pose — Talaj</td><td>+100</td></tr><tr><td>Main pleine sans pose — Sample</td><td>+51</td></tr><tr><td>Cartes restantes après pose partielle — Talaj</td><td>10 fixes par carte</td></tr><tr><td>Cartes restantes après pose partielle — Sample</td><td>Valeur faciale (V/D/R/As et joker = 10)</td></tr>',
      en: '<tr><td>Finish Round</td><td>0 penalty points (Round Win)</td></tr><tr><td>Invalid meld/opening — Talaj</td><td>+71 penalty points</td></tr><tr><td>Invalid meld/opening — Sample</td><td>+51 penalty points</td></tr><tr><td>Take card without conditions — Talaj</td><td>+71 (card returned)</td></tr><tr><td>Take card without conditions — Sample</td><td>+51</td></tr><tr><td>Violate 12-card rule</td><td>+71</td></tr><tr><td>Full hand without lay-down — Talaj</td><td>+100</td></tr><tr><td>Full hand without lay-down — Sample</td><td>+51</td></tr><tr><td>Remaining after partial lay-down — Talaj</td><td>Flat 10 per card</td></tr><tr><td>Remaining after partial lay-down — Sample</td><td>Face value (J/Q/K/A & Joker = 10)</td></tr><tr><td>Doubled round (free isolated Joker finish)</td><td>Remaining/full-hand points ×2 (penalties not doubled)</td></tr>'
    },
    tips: {
      ar: [
        'في الطلاح: لا تُحسب ورقة الجوكر ضمن نقاط الافتتاح (يجب تجاوز 71 بدونها).',
        'في السامبل: راقب ورقة المؤشر — نظيرتها المعاكسة اللون تصبح الجوكر، وتُحسب 10 عند كشف الأوراق.',
        'الإنهاء الأساسي (14 ورقة + رمي الورقة 15) لا يتطلب أي شرط افتتاح.',
        'قاعدة الـ12 ورقة: إن أنزلت 12 ورقة فخذ ورقة المرموق المطابقة لمجموعات الطاولة، وإلا فالجزاء +71.'
      ],
      da: [
        'فالطالاج: الجوكر ما كيتحسبش فنقاط الافتتاح (خاصك تفوت 71 بلا بيه).',
        'فالسامبل: رد البال لورقة المؤشر — النظير المعكوس ديالها كيولي جوكر وكيتحسب 10.',
        'الإنهاء الأساسي (14 ورقة + رمي الورقة 15) ما كيحتاج حتى شرط افتتاح.',
        'قاعدة الـ12: إلا نزلتي 12 ورقة خذ المرموق المطابق للمجموعات وإلا +71.'
      ],
      fr: [
        'En Talaj : le joker ne compte pas dans l\'ouverture (il faut dépasser 71 sans lui).',
        'En Sample : surveillez la carte indicatrice — sa contrepartie de couleur inversée devient le joker et vaut 10 à la révélation.',
        'La fin de manche standard (14 cartes + défausse de la 15e) n\'exige aucune condition d\'ouverture.',
        'Règle des 12 cartes : si vous en posez 12, prenez la défausse qui complète une combinaison, sinon +71.'
      ],
      en: [
        'In Talaj: the Joker does not count toward the opening (you must exceed 71 without it).',
        'In Sample: watch the indicator card — its colour-reversed counterpart becomes the Joker and counts 10 at reveal.',
        'Standard round finish (14 cards + discarding the 15th) requires no opening condition.',
        '12-card rule: if you have laid 12 cards, take the discard that fits a meld, otherwise +71.'
      ]
    }
  },

rn: {
    name: { ar: 'روندا المغربية ♦️♠️', fr: 'Ronda Marocaine ♦️♠️', en: 'Moroccan Ronda ♦️♠️' },
    goal: {
      ar: 'خمّن البطاقة الصحيحة (رقم أو رقم + رمز) قبل الموزع للفوز بالجولة.',
      fr: 'Devinez la bonne carte (numéro ou numéro + symbole) avant le donneur pour gagner.',
      en: 'Guess the correct card (number or number + symbol) before the dealer to win the round.'
    },
    steps: {
      ar: [
        'حدد مبلغ الرهان ثم اختر وضع اللعب: رقم فقط (×2) أو رقم + رمز (×3)',
        'اختر رقماً من الأوراق المغاربية (1-7، 10-12) ثم أكّد',
        'في وضع الرمز، اختر أيضاً الرمز: ◆ ذهب، ♥ كؤوس، ♠ سيوف، ♣ صولجان',
        'يتم سحب البطاقات بالتناوب بينك وبين الموزع (40 ورقة مغاربية)',
        'إذا ظهرت بطاقتك المختارة أولاً، تفوز وتتبادل الأدوار',
        'عند الخسارة يخصم الرهان من رصيدك — راقب رصيدك جيداً'
      ],
      fr: [
        'Choisissez votre mise puis le mode : numéro seul (×2) ou numéro + symbole (×3)',
        'Choisissez un numéro (1-7, 10-12) puis confirmez',
        'En mode symbole, choisissez aussi : ◆ Or, ♥ Coupes, ♠ Épées, ♣ Bâtons',
        'Les cartes sont tirées alternativement (jeu de 40 cartes marocaines)',
        'Si votre carte apparaît en premier, vous gagnez et les rôles s\'inversent',
        'En cas de défaite, la mise est déduite de votre solde'
      ],
      en: [
        'Set your bet, then choose game mode: number only (×2) or number + suit (×3)',
        'Pick a number (1-7, 10-12) and confirm',
        'In suit mode, also pick: ◆ Gold, ♥ Cups, ♠ Swords, ♣ Clubs',
        'Cards are drawn alternately between you and the dealer (40 Moroccan cards)',
        'If your card appears first, you win and roles swap',
        'On a loss, the bet is deducted from your balance'
      ]
    },
    payouts: {
      ar: '<tr><td>رقم فقط</td><td>×2</td></tr><tr><td>رقم + رمز</td><td>×3</td></tr>',
      fr: '<tr><td>Numéro seul</td><td>×2</td></tr><tr><td>Numéro + Symbole</td><td>×3</td></tr>',
      en: '<tr><td>Number only</td><td>×2</td></tr><tr><td>Number + Symbol</td><td>×3</td></tr>'
    },
    tips: {
      ar: [
        'الرهان على رقم فقط أسهل لكن الربح أقل',
        'راقب البطاقات المسحوبة لتقدير الاحتمالات',
        'كلما زاد عدد البطاقات المسحوبة، قلّت الخيارات المتبقية'
      ],
      fr: [
        'Parier sur le numéro seul est plus facile mais rapporte moins',
        'Observez les cartes tirées pour estimer les probabilités',
        'Plus il y a de cartes tirées, moins il reste d\'options'
      ],
      en: [
        'Betting on number only is easier but pays less',
        'Watch drawn cards to estimate probabilities',
        'The more cards drawn, the fewer options remain'
      ]
    }
  },
  /* ═══ Crash ═══ */
  av: {
    name: { ar: 'أفياتور كراش', fr: 'Aviator Crash', en: 'Aviator Crash' },
    goal: {
      ar: 'اسحب أرباحك قبل أن يتحطم المضاعف. كلما انتظرت أكثر، زاد الربح — لكن الخطر أيضاً!',
      fr: 'Encaissez avant que le multiplicateur ne crash. Plus vous attendez, plus vous gagnez — mais le risque aussi !',
      en: 'Cash out before the multiplier crashes. The longer you wait, the more you win — but so does the risk!'
    },
    steps: {
      ar: [
        'حدد مبلغ الرهان',
        'اضغط "ابدأ" لإقلاع الطائرة',
        'المضاعف يبدأ من 1.00× ويزداد',
        'اضغط "سحب" في أي وقت لأخذ الربح',
        'إذا تحطمت الطائرة قبل السحب، تخسر الرهان'
      ],
      fr: [
        'Définissez le montant du pari',
        'Cliquez sur "Démarrer" pour lancer l\'avion',
        'Le multiplicateur commence à 1.00× et augmente',
        'Cliquez sur "Encaisser" à tout moment pour prendre le gain',
        'Si l\'avion crash avant l\'encaissement, vous perdez le pari'
      ],
      en: [
        'Set your bet amount',
        'Click "Start" to launch the plane',
        'Multiplier starts at 1.00× and increases',
        'Click "Cash Out" anytime to take profit',
        'If the plane crashes before cashing out, you lose the bet'
      ]
    },
    payouts: {
      ar: '<tr><td>سحب عند 2.00×</td><td>×2 الرهان</td></tr><tr><td>سحب عند 5.00×</td><td>×5 الرهان</td></tr><tr><td>سحب عند 10.00×</td><td>×10 الرهان</td></tr>',
      fr: '<tr><td>Encaisser à 2.00×</td><td>×2 le pari</td></tr><tr><td>Encaisser à 5.00×</td><td>×5 le pari</td></tr><tr><td>Encaisser à 10.00×</td><td>×10 le pari</td></tr>',
      en: '<tr><td>Cash at 2.00×</td><td>×2 bet</td></tr><tr><td>Cash at 5.00×</td><td>×5 bet</td></tr><tr><td>Cash at 10.00×</td><td>×10 bet</td></tr>'
    },
    tips: {
      ar: [
        'السحب المبكر (1.5× - 2×) أكثر أماناً',
        'لا تطمع — حدد هدفاً والتزم به',
        'راقب تاريخ الجولات السابقة'
      ],
      fr: [
        'Encaisser tôt (1.5× - 2×) est plus sûr',
        'Ne soyez pas gourmand — fixez un objectif',
        'Observez l\'historique des tours précédents'
      ],
      en: [
        'Early cash out (1.5× - 2×) is safer',
        'Don\'t be greedy — set a target and stick to it',
        'Watch previous round history'
      ]
    }
  },
  /* ═══ Blackjack ═══ */
  bj: {
    name: { ar: 'بلاك جاك 21', fr: 'Blackjack 21', en: 'Blackjack 21' },
    goal: {
      ar: 'احصل على مجموع أقرب إلى 21 من الموزع دون تجاوزه.',
      fr: 'Obtenez un total plus proche de 21 que le donneur sans le dépasser.',
      en: 'Get a total closer to 21 than the dealer without going over.'
    },
    steps: {
      ar: [
        'اضغط "توزيع" لبدء الجولة',
        'تحصل على بطاقتين والموزع على بطاقتين (واحدة مخفية)',
        '"بطاقة" لسحب بطاقة إضافية',
        '"وقوف" للتوقف والمقارنة',
        '"Double" لمضاعفة الرهان مع بطاقة واحدة إضافية',
        '"Split" لتقسيم بطاقتين متساويتين'
      ],
      fr: [
        'Cliquez sur "Distribuer" pour commencer',
        'Vous recevez 2 cartes, le donneur 2 (une cachée)',
        '"Tirer" pour une carte supplémentaire',
        '"Rester" pour comparer',
        '"Double" pour doubler le pari avec une carte',
        '"Split" pour diviser deux cartes égales'
      ],
      en: [
        'Click "Deal" to start the round',
        'You get 2 cards, dealer gets 2 (one hidden)',
        '"Hit" to draw an additional card',
        '"Stand" to stop and compare',
        '"Double" to double bet with one more card',
        '"Split" to split two equal cards'
      ]
    },
    payouts: {
      ar: '<tr><td>فوز عادي</td><td>×2</td></tr><tr><td>Blackjack (21 بورقتين)</td><td>×2.5</td></tr><tr><td>Push (تعادل)</td><td>استرداد</td></tr>',
      fr: '<tr><td>Victoire normale</td><td>×2</td></tr><tr><td>Blackjack (21 en 2 cartes)</td><td>×2.5</td></tr><tr><td>Push (égalité)</td><td>Remboursé</td></tr>',
      en: '<tr><td>Normal win</td><td>×2</td></tr><tr><td>Blackjack (21 in 2 cards)</td><td>×2.5</td></tr><tr><td>Push (tie)</td><td>Refund</td></tr>'
    },
    tips: {
      ar: [
        'قف دائماً عند 17 أو أكثر',
        'اسحب عند 11 أو أقل دائماً',
        'قسّم الآسات والثمانيات دائماً',
        'لا تقسّم العشرات أو الخمسات'
      ],
      fr: [
        'Restez toujours à 17 ou plus',
        'Tirez toujours à 11 ou moins',
        'Divisez toujours les As et les 8',
        'Ne divisez jamais les 10 ou les 5'
      ],
      en: [
        'Always stand on 17 or higher',
        'Always hit on 11 or lower',
        'Always split Aces and 8s',
        'Never split 10s or 5s'
      ]
    }
  },
  /* ═══ Mines ═══ */
  mn: {
    name: { ar: 'ماينز', fr: 'Mines', en: 'Mines' },
    goal: {
      ar: 'افتح الخانات وتجنب الألغام. كل خانة آمنة تزيد المضاعف!',
      fr: 'Ouvrez les cases et évitez les mines. Chaque case sûre augmente le multiplicateur !',
      en: 'Reveal tiles and avoid mines. Each safe tile increases the multiplier!'
    },
    steps: {
      ar: [
        'اختر عدد الألغام (3-24)',
        'حدد الرهان واضغط ابدأ',
        'اضغط على الخانات لكشفها',
        'كل خانة آمنة تزيد مضاعفك',
        'اسحب في أي وقت أو واصل حتى لغم'
      ],
      fr: [
        'Choisissez le nombre de mines (3-24)',
        'Définissez le pari et commencez',
        'Cliquez sur les cases pour les révéler',
        'Chaque case sûre augmente votre multiplicateur',
        'Encaissez à tout moment ou continuez'
      ],
      en: [
        'Choose number of mines (3-24)',
        'Set bet and start',
        'Click tiles to reveal them',
        'Each safe tile increases your multiplier',
        'Cash out anytime or push your luck'
      ]
    },
    payouts: {
      ar: '<tr><th colspan="2">مضاعفات الرهان (GB) — الصيغة: (1 ÷ (1 − ألغام/25)) أس عدد الخانات الآمنة</th></tr><tr><td><b>3</b> ألغام</td><td>5 → ×1.89 · 10 → ×3.59 · 15 → ×6.8 · 20 → ×12.89 · 22 → ×16.65</td></tr><tr><td><b>5</b> ألغام</td><td>5 → ×3.05 · 10 → ×9.31 · 15 → ×28.42 · 20 → ×86.74</td></tr><tr><td><b>10</b> ألغام</td><td>5 → ×12.86 · 10 → ×165.38 · 15 → ×2126.82</td></tr><tr><td><b>15</b> ألغام</td><td>5 → ×97.66 · 10 → ×9536.74</td></tr><tr><td><b>24</b> ألغام</td><td>1 → ×25</td></tr><tr><td colspan="2">مضاعفات عادلة رياضياً — RTP 100% (إما كاش بالمضاعف أو لغم = 0)</td></tr>',
      fr: '<tr><th colspan="2">Multiplicateurs de la mise (GB) — formule : (1 ÷ (1 − mines/25)) puissance cases sûres</th></tr><tr><td><b>3</b> mines</td><td>5 → ×1,89 · 10 → ×3,59 · 15 → ×6,8 · 20 → ×12,89 · 22 → ×16,65</td></tr><tr><td><b>5</b> mines</td><td>5 → ×3,05 · 10 → ×9,31 · 15 → ×28,42 · 20 → ×86,74</td></tr><tr><td><b>10</b> mines</td><td>5 → ×12,86 · 10 → ×165,38 · 15 → ×2126,82</td></tr><tr><td><b>15</b> mines</td><td>5 → ×97,66 · 10 → ×9536,74</td></tr><tr><td><b>24</b> mines</td><td>1 → ×25</td></tr><tr><td colspan="2">Multiplicateurs mathématiquement équitables — RTP 100 % (encaissez le multiplicateur ou mine = 0)</td></tr>',
      en: '<tr><th colspan="2">Bet multipliers (GB) — formula: (1 ÷ (1 − mines/25)) ^ safe tiles</th></tr><tr><td><b>3</b> mines</td><td>5 → ×1.89 · 10 → ×3.59 · 15 → ×6.8 · 20 → ×12.89 · 22 → ×16.65</td></tr><tr><td><b>5</b> mines</td><td>5 → ×3.05 · 10 → ×9.31 · 15 → ×28.42 · 20 → ×86.74</td></tr><tr><td><b>10</b> mines</td><td>5 → ×12.86 · 10 → ×165.38 · 15 → ×2126.82</td></tr><tr><td><b>15</b> mines</td><td>5 → ×97.66 · 10 → ×9536.74</td></tr><tr><td><b>24</b> mines</td><td>1 → ×25</td></tr><tr><td colspan="2">Mathematically fair multipliers — RTP 100% (cash out the multiplier or mine = 0)</td></tr>'
    },
    tips: {
      ar: ['المزيد من الألغام = مضاعفات أعلى لكن خطر أكبر', 'اسحب بعد 5-8 خانات للربح الآمن'],
      fr: ['Plus de mines = multiplicateurs plus élevés mais plus de risque', 'Encaissez après 5-8 cases pour un gain sûr'],
      en: ['More mines = higher multipliers but more risk', 'Cash out after 5-8 tiles for safe profit']
    }
  },
  /* ═══ Parchisi ═══ */
  pr: {
    name: { ar: 'بارشيسي', fr: 'Parchisi', en: 'Parchisi' },
    goal: {
      ar: 'أوّل لاعب يوصل كل قطعه الأربع إلى النهاية يفوز!',
      fr: 'Le premier joueur à amener ses 4 pièces à l\'arrivée gagne !',
      en: 'First player to bring all 4 pieces to the finish wins!'
    },
    steps: {
      ar: [
        'ارمِ النرد للتحرك',
        'الخروج من القاعدة يتطلب نرد 5',
        'النرد 6 = رمية إضافية (حتى 3 رميات متتالية)',
        '3 ستات متتالية = كارثة: آخر قطعة تحركت تعود للقاعدة',
        'لا قطع في القاعدة + نرد 6 = حركة 7 خانات',
        '12 خلية آمنة (4 ساليدات + 8): لا أكل فيها',
        'أكل قطعة خصم وحيدة = +20 خانة للقطعة الآكلة',
        'قطعتان من لونك في خلية = حاجز يمنع مرور الخصوم والهبوط فوقه — رمي 6 يلزمك بتحريكه',
        'الدخول للميتا بنرد مضبوط — إدخال قطعة = +10 لقطعة أخرى',
        'أول من يُدخل قطعه الأربع يفوز'
      ],
      fr: [
        'Lancez le dé pour avancer',
        'Il faut un 5 pour sortir une pièce de la base',
        'Un 6 donne un lancer supplémentaire (max 3 lancers)',
        '3 six consécutifs = catastrophe : la dernière pièce déplacée rentre à la base',
        'Aucune pièce en base + 6 = avance de 7 cases',
        '12 cases sûres (4 sorties + 8) : aucune capture',
        'Capturer une pièce seule = +20 cases pour la pièce qui capture',
        'Deux pièces de même couleur = barrage bloquant passage et atterrissage — un 6 oblige à l\'ouvrir',
        'Entrée à la maison avec un score exact — entrer une pièce = +10 pour une autre',
        'Le premier à entrer ses 4 pièces gagne'
      ],
      en: [
        'Roll the dice to move',
        'You need a 5 to bring a piece out of base',
        'A 6 grants an extra roll (max 3 rolls in a row)',
        '3 consecutive 6s = disaster: the last moved piece returns to base',
        'No pieces in base + roll 6 = move 7 squares',
        '12 safe cells (4 exits + 8): no capture there',
        'Capturing a lone piece = +20 squares for the capturing piece',
        'Two same-color pieces on a cell = barrier blocking passage and landing — rolling 6 forces you to move it',
        'Enter home with an exact roll — entering a piece = +10 for another',
        'First to bring all 4 pieces home wins'
      ]
    },
    payouts: {
      ar: '<tr><td>فوز (لاعبان)</td><td>×1.9 الرهان</td></tr><tr><td>فوز (ثلاثة)</td><td>×2.85 الرهان</td></tr><tr><td>فوز (أربعة)</td><td>×3.8 الرهان</td></tr><tr><td>خسارة</td><td>خسارة الرهان</td></tr>',
      fr: '<tr><td>Victoire (2 joueurs)</td><td>×1.9 la mise</td></tr><tr><td>Victoire (3 joueurs)</td><td>×2.85 la mise</td></tr><tr><td>Victoire (4 joueurs)</td><td>×3.8 la mise</td></tr><tr><td>Défaite</td><td>Perte de la mise</td></tr>',
      en: '<tr><td>Win (2 players)</td><td>×1.9 bet</td></tr><tr><td>Win (3 players)</td><td>×2.85 bet</td></tr><tr><td>Win (4 players)</td><td>×3.8 bet</td></tr><tr><td>Loss</td><td>Lose bet</td></tr>'
    },
    tips: {
      ar: ['أخرج قطعك بالنرد 5 مبكراً', 'استخدم الخلايا الآمنة والحواجز للحماية', 'ادخل الميتا بنرد مضبوط ولا تنسَ +10 و+20'],
      fr: ['Sortez vos pièces avec un 5 tôt', 'Utilisez cases sûres et barrages', 'Entrez à la maison avec un score exact, pensez au +10 et +20'],
      en: ['Bring pieces out with a 5 early', 'Use safe cells and barriers for defense', 'Enter home with exact roll, remember +10 and +20']
    }
  },
  /* ═══ Slots ═══ */
  sl: {
    name: { ar: 'رويال سلوتس', fr: 'Royal Slots', en: 'Royal Slots' },
    goal: {
      ar: 'أدر البكرات: 3 رموز متطابقة = جاكبوت (حتى ×120)، 2 متطابقة = استرداد رهانك!',
      fr: 'Faites tourner les rouleaux : 3 symboles identiques = jackpot (jusqu\'à ×120), 2 identiques = pari remboursé !',
      en: 'Spin the reels: 3 matching symbols = jackpot (up to ×120), 2 matching = bet refunded!'
    },
    steps: {
      ar: [
        'حدد الرهان ثم اضغط "🎰 لِف!"',
        '3 بكرات تتوقف تباعاً عن رمز من 8 رموز متساوية الاحتمال',
        '3 متطابقة: ربح = الرهان × مضاعف الرمز (7️⃣ ×120، 🍒 ×60 …)',
        '2 متطابقة: استرداد الرهان كاملاً (لا ربح ولا خسارة)',
        'بلا تطابق: خسارة الرهان — RTP 95.9%'
      ],
      fr: [
        'Définissez le pari puis cliquez "🎰 Tourner"',
        '3 rouleaux s\'arrêtent l\'un après l\'autre sur un symbole parmi 8 équiprobables',
        '3 identiques : gain = mise × multiplicateur (7️⃣ ×120, 🍒 ×60…)',
        '2 identiques : pari remboursé intégralement',
        'Aucune paire : mise perdue — RTP 95,9 %'
      ],
      en: [
        'Set your bet then hit "🎰 SPIN"',
        '3 reels stop one by one on a symbol among 8 equally likely',
        '3 matching: win = bet × symbol multiplier (7️⃣ ×120, 🍒 ×60…)',
        '2 matching: full bet refund',
        'No match: bet lost — RTP 95.9%'
      ]
    },
    payouts: {
      ar: '<tr><td>7️⃣7️⃣7️⃣</td><td>×120</td></tr><tr><td>🍒🍒🍒</td><td>×60</td></tr><tr><td>🍇🍇🍇</td><td>×40</td></tr><tr><td>⭐⭐⭐</td><td>×30</td></tr><tr><td>🍋🍋🍋</td><td>×25</td></tr><tr><td>🔔🔔🔔</td><td>×20</td></tr><tr><td>💎💎💎</td><td>×15</td></tr><tr><td>🚀🚀🚀</td><td>×12</td></tr><tr><td>رمزان متطابقان</td><td>استرداد الرهان</td></tr>',
      fr: '<tr><td>7️⃣7️⃣7️⃣</td><td>×120</td></tr><tr><td>🍒🍒🍒</td><td>×60</td></tr><tr><td>🍇🍇🍇</td><td>×40</td></tr><tr><td>⭐⭐⭐</td><td>×30</td></tr><tr><td>🍋🍋🍋</td><td>×25</td></tr><tr><td>🔔🔔🔔</td><td>×20</td></tr><tr><td>💎💎💎</td><td>×15</td></tr><tr><td>🚀🚀🚀</td><td>×12</td></tr><tr><td>2 identiques</td><td>pari remboursé</td></tr>',
      en: '<tr><td>7️⃣7️⃣7️⃣</td><td>×120</td></tr><tr><td>🍒🍒🍒</td><td>×60</td></tr><tr><td>🍇🍇🍇</td><td>×40</td></tr><tr><td>⭐⭐⭐</td><td>×30</td></tr><tr><td>🍋🍋🍋</td><td>×25</td></tr><tr><td>🔔🔔🔔</td><td>×20</td></tr><tr><td>💎💎💎</td><td>×15</td></tr><tr><td>🚀🚀🚀</td><td>×12</td></tr><tr><td>2 matching</td><td>bet refunded</td></tr>'
    },
    tips: {
      ar: [
        'RTP 95.9% — العائد نظري على المدى الطويل',
        'كل رمز متساوي الاحتمال (1/8) — كل لفة مستقلة تماماً (RNG)',
        'جاكبوت 7️⃣ ×120 نادر لكنه ممكن: احتماله 1 من 512'
      ],
      fr: [
        'RTP 95,9 % — le retour est théorique à long terme',
        'Chaque symbole est équiprobable (1/8) — chaque tour est indépendant (RNG)',
        'Le jackpot 7️⃣ ×120 est rare mais possible : probabilité 1 sur 512'
      ],
      en: [
        '95.9% RTP — return is theoretical long-term',
        'Each symbol is equally likely (1/8) — every spin is independent (RNG)',
        'The 7️⃣ ×120 jackpot is rare but possible: 1 in 512 chance'
      ]
    }
  },
  /* ═══ Plinko ═══ */
  pl: {
    name: { ar: 'بلينكو', fr: 'Plinko', en: 'Plinko' },
    goal: {
      ar: 'أسقط الكرة من الأعلى؛ عند كل صف تتخذ الكرة قراراً عشوائياً (يمين/يسار) وتهبط في خانة مضاعف في الأسفل — الأطراف مضاعفات ضخمة واحتمالها منخفض، والوسط ربح متكرر صغير.',
      fr: 'Lâchez la balle depuis le haut ; à chaque rangée elle prend une décision aléatoire (droite/gauche) et atterrit dans une case multiplicateur en bas — les bords offrent d\'énormes multiplicateurs mais sont rares, le centre paie petit mais souvent.',
      en: 'Drop the ball from the top; at each row it makes a random left/right decision and lands in a multiplier slot below — edges pay huge multipliers but are rare, the center pays small but often.'
    },
    steps: {
      ar: [
        'اختر عدد الصفوف: 8 / 10 / 12 / 16 (عدد الخانات = الصفوف + 1)',
        'حدد مبلغ الرهان',
        'اضغط "أفلت الكرة" — قرار عشوائي واحد عند كل صف (توزيع ثنائي)',
        'تهبط في خانة مضاعف وتُدفع لك فوراً',
        'RTP 95% — متوسط العائد نظري على المدى الطويل'
      ],
      fr: [
        'Choisissez le nombre de rangées : 8 / 10 / 12 / 16 (cases = rangées + 1)',
        'Définissez le montant du pari',
        'Cliquez sur "Lâcher" — une décision aléatoire à chaque rangée (distribution binomiale)',
        'Elle atterrit dans une case multiplicateur et vous êtes payé immédiatement',
        'RTP 95 % — retour théorique à long terme'
      ],
      en: [
        'Choose the number of rows: 8 / 10 / 12 / 16 (slots = rows + 1)',
        'Set your bet amount',
        'Click "Drop" — one random decision at each row (binomial distribution)',
        'It lands in a multiplier slot and you are paid instantly',
        '95% RTP — theoretical long-term return'
      ]
    },
    payouts: {
      ar: '<tr><td colspan="2">12 صفاً افتراضياً (13 خانة) — يتغير الجدول مع عدد الصفوف</td></tr><tr><td>أقصى الطرف</td><td>×299.3</td></tr><tr><td>الثاني من الطرف</td><td>×24.9</td></tr><tr><td>الثالث من الطرف</td><td>×4.5</td></tr><tr><td>الرابع من الطرف</td><td>×1.4</td></tr><tr><td>الخامس من الطرف</td><td>×0.6</td></tr><tr><td>السادس من الطرف</td><td>×0.4</td></tr><tr><td>الوسط تماماً</td><td>×0.32</td></tr>',
      fr: '<tr><td colspan="2">12 rangées par défaut (13 cases) — le tableau change avec les rangées</td></tr><tr><td>Bord extrême</td><td>×299.3</td></tr><tr><td>Deuxième depuis le bord</td><td>×24.9</td></tr><tr><td>Troisième depuis le bord</td><td>×4.5</td></tr><tr><td>Quatrième depuis le bord</td><td>×1.4</td></tr><tr><td>Cinquième depuis le bord</td><td>×0.6</td></tr><tr><td>Sixième depuis le bord</td><td>×0.4</td></tr><tr><td>Centre exact</td><td>×0.32</td></tr>',
      en: '<tr><td colspan="2">12 default rows (13 slots) — table changes with rows</td></tr><tr><td>Extreme edge</td><td>×299.3</td></tr><tr><td>Second from edge</td><td>×24.9</td></tr><tr><td>Third from edge</td><td>×4.5</td></tr><tr><td>Fourth from edge</td><td>×1.4</td></tr><tr><td>Fifth from edge</td><td>×0.6</td></tr><tr><td>Sixth from edge</td><td>×0.4</td></tr><tr><td>Dead center</td><td>×0.32</td></tr>'
    },
    tips: {
      ar: [
        'مضاعفات الأطراف ضخمة لكن احتمالها نادر جداً',
        'الوسط يدفع أقل من الرهان لكنه يتحقق غالباً',
        'كل إسقاط مستقل تماماً (توزيع ثنائي عادل)'
      ],
      fr: [
        'Les multiplicateurs des bords sont énormes mais très rares',
        'Le centre paie moins que la mise mais arrive souvent',
        'Chaque chute est totalement indépendante (distribution binomiale équitable)'
      ],
      en: [
        'Edge multipliers are huge but very rare',
        'The center pays less than the bet but hits often',
        'Every drop is completely independent (fair binomial distribution)'
      ]
    }
  },
  /* ═══ Dice ═══ */
  dc: {
    name: { ar: 'نرد', fr: 'Dice', en: 'Dice' },
    goal: {
      ar: 'اضبط الهدف (1-98) واختر "أقل من" أو "فوق". تُرمى 3 نردات وتظهر النتيجة 0.00-99.99 — إذا تحقق شرطك تربح بمضاعف = 98 ÷ الاحتمال!',
      fr: 'Réglez la cible (1-98) et choisissez "Moins que" ou "Au-dessus". Trois dés roulent et le résultat va de 0.00 à 99.99 — si votre condition est remplie, vous gagnez avec un multiplicateur = 98 ÷ probabilité !',
      en: 'Set the target (1-98) and pick "Under" or "Above". Three dice roll and the result is 0.00-99.99 — if your condition is met you win with a multiplier = 98 ÷ probability!'
    },
    steps: {
      ar: [
        'اضبط الهدف بالمؤشر (من 1 إلى 98)',
        'اختر: أقل من الهدف ⬇ أو فوقه ⬆',
        'اضغط "ارمِ النرد!" — تُرمى 3 نردات',
        'النتيجة عشوائية بين 0.00 و99.99',
        'تربح إذا تحقق الشرط — المضاعف = 98 ÷ الاحتمال'
      ],
      fr: [
        'Réglez la cible avec le curseur (de 1 à 98)',
        'Choisissez : Moins que la cible ⬇ ou Au-dessus ⬆',
        'Cliquez sur "Lancer les dés!" — 3 dés roulent',
        'Le résultat est aléatoire entre 0.00 et 99.99',
        'Vous gagnez si la condition est remplie — multiplicateur = 98 ÷ probabilité'
      ],
      en: [
        'Set the target with the slider (from 1 to 98)',
        'Pick: Under the target ⬇ or Above it ⬆',
        'Click "ROLL DICE!" — 3 dice roll',
        'The result is random between 0.00 and 99.99',
        'You win if the condition is met — multiplier = 98 ÷ probability'
      ]
    },
    payouts: {
      ar: '<tr><td>تحت 2</td><td>×49</td></tr><tr><td>تحت 10</td><td>×9.8</td></tr><tr><td>تحت 25</td><td>×3.92</td></tr><tr><td>تحت 50</td><td>×1.96</td></tr><tr><td>فوق 90</td><td>×9.8</td></tr><tr><td>فوق 98</td><td>×49</td></tr>',
      fr: '<tr><td>Sous 2</td><td>×49</td></tr><tr><td>Sous 10</td><td>×9.8</td></tr><tr><td>Sous 25</td><td>×3.92</td></tr><tr><td>Sous 50</td><td>×1.96</td></tr><tr><td>Au-dessus 90</td><td>×9.8</td></tr><tr><td>Au-dessus 98</td><td>×49</td></tr>',
      en: '<tr><td>Under 2</td><td>×49</td></tr><tr><td>Under 10</td><td>×9.8</td></tr><tr><td>Under 25</td><td>×3.92</td></tr><tr><td>Under 50</td><td>×1.96</td></tr><tr><td>Above 90</td><td>×9.8</td></tr><tr><td>Above 98</td><td>×49</td></tr>'
    },
    tips: {
      ar: [
        'ارفع الهدف لزيادة فرص الفوز (مضاعف أقل)',
        'خفّض الهدف للربح الكبير لكن الخطر أعلى',
        'هدف 50 (أقل من أو فوق) يعادل تقريباً عملة — فرصة 50%'
      ],
      fr: [
        'Augmentez la cible pour plus de chances (multiplicateur plus bas)',
        'Baissez la cible pour un gros gain mais plus de risque',
        'Cible 50 (sous ou au-dessus) ≈ pile ou face — 50% de chance'
      ],
      en: [
        'Raise the target for higher chances (lower multiplier)',
        'Lower the target for a big win but more risk',
        'Target 50 (under or above) is about a coin flip — 50% chance'
      ]
    }
  },
  /* ═══ Coin Flip 3D ═══ */
  cf: {
    name: { ar: 'قلب العملة 3D', fr: 'Coin Flip 3D', en: 'Coin Flip 3D' },
    goal: {
      ar: 'اختر وجه العملة أو كتابتها. إذا طابق اختيارك النتيجة بعد الدوران، تربح!',
      fr: 'Choisissez pile ou face. Si votre choix correspond après la rotation, vous gagnez !',
      en: 'Pick heads or tails. If your choice matches after the spin, you win!'
    },
    steps: {
      ar: [
        'اختر "🪙 Heads" أو "Tails"',
        'اضغط على اختيارك لقلب العملة',
        'العملة تدور 3D وتستقر على وجه عشوائي',
        'تطابق الاختيار = ربح ×1.95'
      ],
      fr: [
        'Choisissez "🪙 Heads" ou "Tails"',
        'Cliquez pour lancer la pièce',
        'La pièce tourne en 3D et retombe sur une face aléatoire',
        'Correspondance = gain ×1.95'
      ],
      en: [
        'Choose "🪙 Heads" or "Tails"',
        'Click to flip the coin',
        'The coin spins in 3D and lands on a random face',
        'Match = win ×1.95'
      ]
    },
    payouts: {
      ar: '<tr><td>تطابق الوجه المختار</td><td>×1.95</td></tr><tr><td>عدم التطابق</td><td>خسارة الرهان</td></tr>',
      fr: '<tr><td>Face choisie</td><td>×1.95</td></tr><tr><td>Pas de correspondance</td><td>Perte du pari</td></tr>',
      en: '<tr><td>Chosen side matches</td><td>×1.95</td></tr><tr><td>No match</td><td>Lose bet</td></tr>'
    },
    tips: {
      ar: [
        'اللعبة عادلة تماماً: 50/50 مع RNG',
        'لا توجد استراتيجية تزيد فرصك — العب للترفيه',
        'المضاعف 1.95 بدل 2 هو هامش الكازينو'
      ],
      fr: [
        'Jeu parfaitement équitable : 50/50 avec RNG',
        'Aucune stratégie n\'augmente vos chances — jouez pour le plaisir',
        'Le multiplicateur de 1.95 au lieu de 2 est la marge du casino'
      ],
      en: [
        'Perfectly fair game: 50/50 with RNG',
        'No strategy increases your chances — play for fun',
        'The 1.95 multiplier instead of 2 is the house edge'
      ]
    }
  },
  /* ═══ Hi-Lo Cards ═══ */
  hl: {
    name: { ar: 'هاي لو كاردز', fr: 'Hi-Lo Cartes', en: 'Hi-Lo Cards' },
    goal: {
      ar: 'خمّن ما إذا كانت البطاقة التالية أعلى أم أقل من البطاقة الحالية.',
      fr: 'Devinez si la carte suivante est plus haute ou plus basse que la carte actuelle.',
      en: 'Guess whether the next card is higher or lower than the current card.'
    },
    steps: {
      ar: [
        'تظهر بطاقة البداية تلقائياً عند فتح اللعبة',
        'اضغط "أعلى" أو "أقل" لتوقع البطاقة التالية',
        'تُسحب بطاقة جديدة من المجموعة',
        'تساوي القيم = تعادل (استرداد الرهان)',
        'تخمين صحيح = ربح ×1.9'
      ],
      fr: [
        'La carte de départ est distribuée automatiquement à l\'ouverture',
        'Cliquez sur "Plus haut" ou "Plus bas" pour prédire',
        'Une nouvelle carte est tirée du jeu',
        'Valeurs égales = égalité (pari remboursé)',
        'Bonne prédiction = gain ×1.9'
      ],
      en: [
        'The starting card is dealt automatically when the game opens',
        'Click "Higher" or "Lower" to predict the next card',
        'A new card is drawn from the deck',
        'Equal values = push (bet refunded)',
        'Correct guess = win ×1.9'
      ]
    },
    payouts: {
      ar: '<tr><td>تخمين صحيح</td><td>×1.9</td></tr><tr><td>تعادل (نفس القيمة)</td><td>استرداد</td></tr><tr><td>تخمين خاطئ</td><td>خسارة الرهان</td></tr>',
      fr: '<tr><td>Bonne prédiction</td><td>×1.9</td></tr><tr><td>Égalité (même valeur)</td><td>Remboursé</td></tr><tr><td>Mauvaise prédiction</td><td>Perte du pari</td></tr>',
      en: '<tr><td>Correct guess</td><td>×1.9</td></tr><tr><td>Push (same value)</td><td>Refund</td></tr><tr><td>Wrong guess</td><td>Lose bet</td></tr>'
    },
    tips: {
      ar: [
        'بعد بطاقة منخفضة (2-6)، التالي غالباً أعلى',
        'تجنب التخمين عند البطاقات المتوسطة (7-9)',
        'الاحتمالات تتغير مع كل بطاقة — انتبه'
      ],
      fr: [
        'Après une carte basse (2-6), la suivante est souvent plus haute',
        'Évitez de deviner sur les cartes moyennes (7-9)',
        'Les probabilités changent à chaque carte — restez attentif'
      ],
      en: [
        'After a low card (2-6), the next is usually higher',
        'Avoid guessing on mid cards (7-9)',
        'Odds change with every card — stay alert'
      ]
    }
  },
  /* ═══ Wheel of Fortune ═══ */
  wf: {
    name: { ar: 'عجلة الحظ', fr: 'Wheel of Fortune', en: 'Wheel of Fortune' },
    goal: {
      ar: 'دوّر العجلة وتوقف عند قطاع عشوائي — كل قطاع له مضاعف مختلف (قد تخسر!)',
      fr: 'Faites tourner la roue et arrêtez-vous sur un secteur aléatoire — chaque secteur a un multiplicateur différent (vous pouvez perdre !)',
      en: 'Spin the wheel and land on a random sector — each sector has a different multiplier (you can lose!)'
    },
    steps: {
      ar: [
        'حدد مبلغ الرهان',
        'اضغط "دوران" لتحريك العجلة',
        'العجلة تحتوي 12 قطاعاً بمضاعفات مختلفة',
        'الأقسام موزونة — المضاعف الكبير أقل احتمالاً (RTP 97.5%)',
        'تتوقف على قطاع عشوائي يحدد الربح أو الخسارة'
      ],
      fr: [
        'Définissez le montant du pari',
        'Cliquez sur "Tourner" pour lancer la roue',
        'La roue a 12 secteurs avec des multiplicateurs différents',
        'Les secteurs sont pondérés — le gros multiplicateur est plus rare (RTP 97,5 %)',
        'Elle s\'arrête sur un secteur aléatoire qui détermine le gain ou la perte'
      ],
      en: [
        'Set your bet amount',
        'Click "Spin" to spin the wheel',
        'The wheel has 12 sectors with different multipliers',
        'Sectors are weighted — the big multiplier is rarer (RTP 97.5%)',
        'It stops on a random sector that decides win or loss'
      ]
    },
    payouts: {
      ar: '<tr><td>قطاع ×10</td><td>ربح الرهان ×10</td></tr><tr><td>قطاع ×5</td><td>ربح الرهان ×5</td></tr><tr><td>قطاع ×3</td><td>ربح الرهان ×3</td></tr><tr><td>قطاع ×2 (قطاعان)</td><td>ربح الرهان ×2</td></tr><tr><td>قطاع ×1.5</td><td>ربح الرهان ×1.5</td></tr><tr><td>قطاع ×1 (قطاعان)</td><td>استرداد الرهان</td></tr><tr><td>قطاع ×0.5 (3 قطاعات)</td><td>خسارة جزئية</td></tr><tr><td>قطاع ×0</td><td>خسارة الرهان</td></tr>',
      fr: '<tr><td>Secteur ×10</td><td>Pari ×10</td></tr><tr><td>Secteur ×5</td><td>Pari ×5</td></tr><tr><td>Secteur ×3</td><td>Pari ×3</td></tr><tr><td>Secteur ×2 (deux secteurs)</td><td>Pari ×2</td></tr><tr><td>Secteur ×1.5</td><td>Pari ×1.5</td></tr><tr><td>Secteur ×1 (deux secteurs)</td><td>Pari remboursé</td></tr><tr><td>Secteur ×0.5 (trois secteurs)</td><td>Perte partielle</td></tr><tr><td>Secteur ×0</td><td>Perte du pari</td></tr>',
      en: '<tr><td>×10 sector</td><td>Bet ×10</td></tr><tr><td>×5 sector</td><td>Bet ×5</td></tr><tr><td>×3 sector</td><td>Bet ×3</td></tr><tr><td>×2 sector (two sectors)</td><td>Bet ×2</td></tr><tr><td>×1.5 sector</td><td>Bet ×1.5</td></tr><tr><td>×1 sector (two sectors)</td><td>Bet refunded</td></tr><tr><td>×0.5 sector (three sectors)</td><td>Partial loss</td></tr><tr><td>×0 sector</td><td>Lose bet</td></tr>'
    },
    tips: {
      ar: [
        'احتمال القطاع الأعلى من 1 هو 6 من 12 (نصف العجلة)',
        'قطاعات ×0.5 و×0 تعني خسارة — لا تعتمد على الربح الدائم',
        'كل دوران مستقل تماماً — لا توجد "عجلة ساخنة"'
      ],
      fr: [
        'La probabilité d\'un secteur supérieur à 1 est de 6 sur 12 (moitié de la roue)',
        'Les secteurs ×0.5 et ×0 signifient une perte — ne comptez pas sur un gain permanent',
        'Chaque tour est indépendant — aucune roue "chaude"'
      ],
      en: [
        'The chance of a sector above 1 is 6 out of 12 (half the wheel)',
        '×0.5 and ×0 sectors mean a loss — do not expect steady wins',
        'Every spin is independent — no "hot wheel"'
      ]
    }
  },
  /* ═══ Scratch Card — Diamond Mine ═══ */
  sc: {
    name: { ar: 'كنز الماس', fr: 'Diamond Mine', en: 'Diamond Mine' },
    goal: {
      ar: 'اكشف الماسات 💎 الستة المخفية في شبكة 3×3 واجمع ×80، لكن تجنب الألغام 💣 الثلاثة!',
      fr: 'Révélez les 6 diamants 💎 cachés dans la grille 3×3 et empochez ×80, mais évitez les 3 mines 💣 !',
      en: 'Reveal the 6 hidden diamonds 💎 in the 3×3 grid to win ×80, but avoid the 3 mines 💣!'
    },
    steps: {
      ar: [
        'اضغط "ابدأ" — تُخلط الشبكة عشوائياً: 6 ماسات 💎 و3 ألغام 💣',
        'اضغط على كل خلية لكشف ما بداخلها',
        '💎 ماس = استمر بأمان، 💣 لغم = انفجار وخسارة الرهان',
        'كشف الماسات الست كلها = فوز ×80'
      ],
      fr: [
        'Cliquez sur "Démarrer" — la grille est mélangée aléatoirement : 6 diamants 💎 et 3 mines 💣',
        'Cliquez sur chaque case pour révéler son contenu',
        '💎 diamant = continuez, 💣 mine = explosion et perte de la mise',
        'Révélez les 6 diamants = gain ×80'
      ],
      en: [
        'Click "Start" — the grid is shuffled: 6 diamonds 💎 and 3 mines 💣',
        'Click each tile to reveal what is inside',
        '💎 diamond = safe, 💣 mine = boom, you lose the bet',
        'Reveal all 6 diamonds = win ×80'
      ]
    },
    payouts: {
      ar: '<tr><td>6 ماسات 💎</td><td>×80</td></tr><tr><td>أي لغم 💣</td><td>خسارة</td></tr>',
      fr: '<tr><td>6 diamants 💎</td><td>×80</td></tr><tr><td>Une mine 💣</td><td>Perte</td></tr>',
      en: '<tr><td>All 6 diamonds 💎</td><td>×80</td></tr><tr><td>Any mine 💣</td><td>Loss</td></tr>'
    },
    tips: {
      ar: [
        'احتمال الفوز: شبكة رابحة من أصل 84 (1 ÷ C(9,3))',
        'RTP ≈ 95% — جولة قصيرة ودفع كبير',
        'لا استراتيجية — كل جولة مستقلة تماماً'
      ],
      fr: [
        'Chance de gagner : 1 grille gagnante sur 84 (1 ÷ C(9,3))',
        'RTP ≈ 95% — partie courte, gros gain',
        'Aucune stratégie — chaque partie est indépendante'
      ],
      en: [
        'Win chance: 1 winning grid out of 84 (1 ÷ C(9,3))',
        'RTP ≈ 95% — quick round, big payout',
        'No strategy — every round is fully independent'
      ]
    }
  },
  /* ═══ Wingo Colors ═══ */
  wg: {
    name: { ar: 'وينجو كولرز', fr: 'Wingo Colors', en: 'Wingo Colors' },
    goal: {
      ar: 'اختر لوناً وتوقع لون الكرة العشوائية — أحمر ×1.9، أخضر ×2.85، أزرق ×5.7 (RTP 95%)!',
      fr: 'Choisissez une couleur et devinez la couleur de la boule aléatoire — rouge ×1,9, vert ×2,85, bleu ×5,7 (RTP 95 %) !',
      en: 'Pick a color and guess the color of the random ball — red ×1.9, green ×2.85, blue ×5.7 (RTP 95%)!'
    },
    steps: {
      ar: [
        'اختر لوناً: 🔴 أحمر، 🟢 أخضر، 🔵 أزرق',
        'تُسحب الكرة من مجموعة: أحمر 3 من 6، أخضر 2 من 6، أزرق 1 من 6',
        'إذا طابق اللون اختيارك تربح',
        'المضاعفات: أحمر ×1.9، أخضر ×2.85، أزرق ×5.7 — كل لون RTP 95%'
      ],
      fr: [
        'Choisissez une couleur : 🔴 rouge, 🟢 vert, 🔵 bleu',
        'La boule est tirée d\'un pool : rouge 3/6, vert 2/6, bleu 1/6',
        'Si la couleur correspond à votre choix, vous gagnez',
        'Multiplicateurs : rouge ×1,9, vert ×2,85, bleu ×5,7 — chaque couleur RTP 95 %'
      ],
      en: [
        'Pick a color: 🔴 red, 🟢 green, 🔵 blue',
        'The ball is drawn from a pool: red 3/6, green 2/6, blue 1/6',
        'If the color matches your choice, you win',
        'Multipliers: red ×1.9, green ×2.85, blue ×5.7 — every color RTP 95%'
      ]
    },
    payouts: {
      ar: '<tr><td>🔴 أحمر (احتمال 50%)</td><td>×1.9</td></tr><tr><td>🟢 أخضر (احتمال 33%)</td><td>×2.85</td></tr><tr><td>🔵 أزرق (احتمال 17%)</td><td>×5.7</td></tr>',
      fr: '<tr><td>🔴 Rouge (50%)</td><td>×1,9</td></tr><tr><td>🟢 Vert (33%)</td><td>×2,85</td></tr><tr><td>🔵 Bleu (17%)</td><td>×5,7</td></tr>',
      en: '<tr><td>🔴 Red (50%)</td><td>×1.9</td></tr><tr><td>🟢 Green (33%)</td><td>×2.85</td></tr><tr><td>🔵 Blue (17%)</td><td>×5.7</td></tr>'
    },
    tips: {
      ar: [
        'الأحمر الأكثر احتمالاً لكنه يدفع الأقل',
        'الأزرق يدفع ×5 لكن احتمال ظهوره 1 من 6',
        'لا توجد استراتيجية — الكرة عشوائية'
      ],
      fr: [
        'Le rouge est le plus probable mais paie le moins',
        'Le bleu paie ×5 mais n\'apparaît qu\'1 fois sur 6',
        'Aucune stratégie — la boule est aléatoire'
      ],
      en: [
        'Red is most likely but pays the least',
        'Blue pays ×5 but only appears 1 in 6',
        'No strategy — the ball is random'
      ]
    }
  },
  /* ═══ Rock Paper Scissors ═══ */
  rp: {
    name: { ar: 'حجر ورقة مقص', fr: 'Pierre Papier Ciseaux', en: 'Rock Paper Scissors' },
    goal: {
      ar: 'اهزم الحاسوب في حجر/ورقة/مقص: الحجر يكسر المقص، المقص يقطع الورقة، الورقة تغطي الحجر.',
      fr: 'Battez l\'IA à pierre/papier/ciseaux : la pierre bat les ciseaux, les ciseaux coupent le papier, le papier couvre la pierre.',
      en: 'Beat the computer at rock/paper/scissors: rock crushes scissors, scissors cut paper, paper covers rock.'
    },
    steps: {
      ar: [
        'اختر ✊ حجر أو ✋ ورقة أو ✌️ مقص',
        'الحاسوب يختار عشوائياً في نفس اللحظة',
        'قارن الاختيارين حسب القاعدة',
        'فوز = ×1.95، تعادل = استرداد، خسارة = خسارة الرهان'
      ],
      fr: [
        'Choisissez ✊ pierre, ✋ papier ou ✌️ ciseaux',
        'L\'IA choisit au hasard au même moment',
        'Comparez les deux choix selon la règle',
        'Victoire = ×1.95, égalité = remboursé, défaite = perte'
      ],
      en: [
        'Choose ✊ rock, ✋ paper, or ✌️ scissors',
        'The AI picks randomly at the same moment',
        'Compare the two choices using the rule',
        'Win = ×1.95, tie = refund, loss = lose bet'
      ]
    },
    payouts: {
      ar: '<tr><td>فوز</td><td>×1.95</td></tr><tr><td>تعادل</td><td>استرداد الرهان</td></tr><tr><td>خسارة</td><td>خسارة الرهان</td></tr>',
      fr: '<tr><td>Victoire</td><td>×1.95</td></tr><tr><td>Égalité</td><td>Pari remboursé</td></tr><tr><td>Défaite</td><td>Perte du pari</td></tr>',
      en: '<tr><td>Win</td><td>×1.95</td></tr><tr><td>Tie</td><td>Bet refunded</td></tr><tr><td>Loss</td><td>Lose bet</td></tr>'
    },
    tips: {
      ar: [
        'فرصة الفوز 1 من 3 (مع احتمال تعادل)',
        'لا يمكن التنبؤ باختيار الحاسوب — العب بتوزيع متوازن'
      ],
      fr: [
        '1 chance sur 3 de gagner (avec possibilité d\'égalité)',
        'Impossible de prédire l\'IA — jouez de façon équilibrée'
      ],
      en: [
        '1 in 3 chance to win (ties possible)',
        'You cannot predict the AI — play balanced'
      ]
    }
  },
  /* ═══ Penalty Shootout ═══ */
  pn: {
    name: { ar: 'ركلات الترجيح', fr: 'Penalty Shootout', en: 'Penalty Shootout' },
    goal: {
      ar: 'سجّل ركلة الجزاء: اختر الاتجاه بينما يغوص الحارس. جهة مختلفة عن الحارس = هدف ×1.45!',
      fr: 'Marquez le penalty : choisissez la direction pendant que le gardien plonge. Direction différente du gardien = but ×1.45 !',
      en: 'Score the penalty: pick a direction while the keeper dives. A different direction from the keeper = goal ×1.45!'
    },
    steps: {
      ar: [
        'حدد مبلغ الرهان',
        'اختر جهة التسديد: ⬅️ يسار، ⬆️ وسط، ➡️ يمين',
        'الحارس يختار جهة عشوائياً',
        'جهات مختلفة = هدف ×1.45',
        'نفس الجهة = تصدي وخسارة',
        'الاحتمال: تسجيل 2 من 3 (الحارس 3 جهات) — RTP 96.7%'
      ],
      fr: [
        'Définissez le montant du pari',
        'Choisissez la direction : ⬅️ gauche, ⬆️ centre, ➡️ droite',
        'Le gardien choisit une direction aléatoire',
        'Directions différentes = but ×1.45',
        'Même direction = arrêt et perte',
        'Chances : marquer 2 fois sur 3 (gardien : 3 directions) — RTP 96.7%'
      ],
      en: [
        'Set your bet amount',
        'Choose the direction: ⬅️ left, ⬆️ center, ➡️ right',
        'The keeper picks a random direction',
        'Different directions = goal ×1.45',
        'Same direction = save and loss',
        'Odds: score 2 out of 3 (keeper has 3 directions) — RTP 96.7%'
      ]
    },
    payouts: {
      ar: '<tr><td>هدف (جهة مختلفة عن الحارس)</td><td>×1.45</td></tr><tr><td>تصدي (نفس الجهة)</td><td>خسارة الرهان</td></tr>',
      fr: '<tr><td>But (direction différente)</td><td>×1.45</td></tr><tr><td>Arrêt (même direction)</td><td>Perte du pari</td></tr>',
      en: '<tr><td>Goal (different direction)</td><td>×1.45</td></tr><tr><td>Save (same direction)</td><td>Lose bet</td></tr>'
    },
    tips: {
      ar: [
        'فرصة التسجيل 2 من 3 لأن الحارس يختار عشوائياً',
        'لا يوجد نمط في اختيار الحارس — لا تتبع "سلاسل"'
      ],
      fr: [
        '2 chances sur 3 de marquer car le gardien choisit au hasard',
        'Aucun schéma dans le choix du gardien — pas de "série"'
      ],
      en: [
        '2 in 3 chance to score since the keeper picks randomly',
        'There is no pattern in the keeper\'s choice — no "streaks"'
      ]
    }
  },
  /* ═══ Lucky 7 ═══ */
  l7: {
    name: { ar: 'لاكي 7', fr: 'Lucky 7', en: 'Lucky 7' },
    goal: {
      ar: 'تنبأ بالرقم (1-9): أقل من 7 ×1.4 أو أكبر من 7 ×4.3، والرقم 7 بالضبط ×8.6!',
      fr: 'Prédisez le numéro (1-9) : moins de 7 ×1,4 ou plus de 7 ×4,3, ou exactement 7 ×8,6 !',
      en: 'Predict the number (1-9): below 7 ×1.4, above 7 ×4.3, or exactly 7 ×8.6!'
    },
    steps: {
      ar: [
        'اختر الرهان: "< 7" أو "= 7" أو "> 7"',
        'كُرة مرقمة (1-9) تُسحب عشوائياً',
        '"< 7" يفوز بالأرقام 1-6 (احتمال 6 من 9) — ×1.4',
        '"= 7" يفوز بالرقم 7 فقط (احتمال 1 من 9) — ×8.6',
        '"> 7" يفوز بالرقمين 8 و9 (احتمال 2 من 9) — ×4.3'
      ],
      fr: [
        'Choisissez le pari : "< 7", "= 7" ou "> 7"',
        'Une boule numérotée (1-9) est tirée au hasard',
        '"< 7" gagne avec 1-6 (6 chances sur 9) — ×1,4',
        '"= 7" gagne avec 7 seulement (1 sur 9) — ×8,6',
        '"> 7" gagne avec 8 et 9 (2 sur 9) — ×4,3'
      ],
      en: [
        'Pick your bet: "< 7", "= 7", or "> 7"',
        'A numbered ball (1-9) is drawn at random',
        '"< 7" wins with 1-6 (6 out of 9 chance) — ×1.4',
        '"= 7" wins with 7 only (1 in 9) — ×8.6',
        '"> 7" wins with 8 and 9 (2 out of 9) — ×4.3'
      ]
    },
    payouts: {
      ar: '<tr><td>< 7 (الأرقام 1-6)</td><td>×1.4</td></tr><tr><td>= 7 (الرقم 7 بالضبط)</td><td>×8.6</td></tr><tr><td>> 7 (الرقمان 8-9)</td><td>×4.3</td></tr>',
      fr: '<tr><td>< 7 (numéros 1-6)</td><td>×1,4</td></tr><tr><td>= 7 (exactement 7)</td><td>×8,6</td></tr><tr><td>> 7 (numéros 8-9)</td><td>×4,3</td></tr>',
      en: '<tr><td>< 7 (numbers 1-6)</td><td>×1.4</td></tr><tr><td>= 7 (exactly 7)</td><td>×8.6</td></tr><tr><td>> 7 (numbers 8-9)</td><td>×4.3</td></tr>'
    },
    tips: {
      ar: [
        '"< 7" الأكثر أماناً (6 من 9) لكنه يدفع ×1.4 فقط',
        '"= 7" يدفع ×8.6 لكن احتمال ظهوره ضعيف',
        'كل سحب مستقل — الرقم 7 لا "يستحق" الظهور'
      ],
      fr: [
        '"< 7" est le plus sûr (6 sur 9) mais paie seulement ×1,4',
        '"= 7" paie ×8,6 mais apparaît rarement',
        'Chaque tirage est indépendant — le 7 ne "doit" pas sortir'
      ],
      en: [
        '"< 7" is safest (6 out of 9) but only pays ×1.4',
        '"= 7" pays ×8.6 but rarely appears',
        'Every draw is independent — 7 is not "due"'
      ]
    }
  },
  /* ═══ Sic Bo ═══ */
  sb: {
    name: { ar: 'سيك بو', fr: 'Sic Bo', en: 'Sic Bo' },
    goal: {
      ar: 'تنبأ بنتيجة 3 نردات: صغير/كبير بمضاعف ×2، أو تريبل (ثلاثة متطابقة) ×30!',
      fr: 'Prédisez le résultat de 3 dés : petit/grand ×2, ou triple (trois identiques) ×30 !',
      en: 'Predict the outcome of 3 dice: small/big ×2, or a triple (three of a kind) ×30!'
    },
    steps: {
      ar: [
        'اختر رهاناً: صغير (4-10)، كبير (11-17)، أو تريبل',
        'تُرمى 3 نردات (كل نرد من 1 إلى 6)',
        'الصغير/الكبير لا يشمل التريبلات',
        'تريبل = النردات الثلاثة متطابقة (مثل 3-3-3)',
        'أي تريبل يدفع ×30'
      ],
      fr: [
        'Choisissez un pari : petit (4-10), grand (11-17) ou triple',
        '3 dés sont lancés (chacun de 1 à 6)',
        'Petit/grand excluent les triples',
        'Triple = les trois dés identiques (ex. 3-3-3)',
        'Tout triple paie ×30'
      ],
      en: [
        'Choose a bet: small (4-10), big (11-17), or triple',
        '3 dice are rolled (each from 1 to 6)',
        'Small/big exclude triples',
        'Triple = all three dice identical (e.g. 3-3-3)',
        'Any triple pays ×30'
      ]
    },
    payouts: {
      ar: '<tr><td>صغير (مجموع 4-10، بدون تريبل)</td><td>×2</td></tr><tr><td>كبير (مجموع 11-17، بدون تريبل)</td><td>×2</td></tr><tr><td>تريبل (مثل 4-4-4)</td><td>×30</td></tr>',
      fr: '<tr><td>Petit (total 4-10, sans triple)</td><td>×2</td></tr><tr><td>Grand (total 11-17, sans triple)</td><td>×2</td></tr><tr><td>Triple (ex. 4-4-4)</td><td>×30</td></tr>',
      en: '<tr><td>Small (total 4-10, no triple)</td><td>×2</td></tr><tr><td>Big (total 11-17, no triple)</td><td>×2</td></tr><tr><td>Triple (e.g. 4-4-4)</td><td>×30</td></tr>'
    },
    tips: {
      ar: [
        'الصغير والكبير متساويان تقريباً في الاحتمال (~48%)',
        'التريبل نادر (1 من 36 لكل مجموعة) لكنه يدفع ×30',
        'تجنب رهان التريبل كاستراتيجية أساسية'
      ],
      fr: [
        'Petit et grand ont une probabilité presque égale (~48%)',
        'Le triple est rare (1 sur 36 par combinaison) mais paie ×30',
        'Évitez le triple comme stratégie principale'
      ],
      en: [
        'Small and big have nearly equal odds (~48%)',
        'A triple is rare (1 in 36 per combination) but pays ×30',
        'Avoid betting triple as your main strategy'
      ]
    }
  },
  /* ═══ European Roulette ═══ */
  rl: {
    name: { ar: 'روليت أوروبي', fr: 'Roulette Européenne', en: 'European Roulette' },
    goal: {
      ar: 'تنبأ بلون أو نوع رقم الكرة على العجلة الأوروبية (37 خانة: 0-36). الأرقام الحمراء والسوداء والأخضر 0.',
      fr: 'Prédisez la couleur ou le type de numéro de la bille sur la roue européenne (37 cases : 0-36). Rouges, noirs et le vert 0.',
      en: 'Predict the color or number type of the ball on the European wheel (37 slots: 0-36). Reds, blacks, and green 0.'
    },
    steps: {
      ar: [
        'اختر رهانك: أحمر، أسود، أخضر (0)، زوجي، فردي، أو نطاق',
        'اضغط "دوران" لتحريك العجلة والكرة',
        'تستقر الكرة على رقم من 0 إلى 36',
        'أحمر/أسود/زوجي/فردي يدفع ×2',
        'الأخضر (0) يدفع ×14',
        'النطاقات 1-12 / 13-24 / 25-36 تدفع ×3، ونطاقا 1-18 / 19-36 يدفعان ×2'
      ],
      fr: [
        'Choisissez votre pari : rouge, noir, vert (0), pair, impair ou plage',
        'Cliquez sur "Tourner" pour lancer la roue et la bille',
        'La bille s\'arrête sur un numéro de 0 à 36',
        'Rouge/noir/pair/impair paie ×2',
        'Le vert (0) paie ×14',
        'Les plages 1-12 / 13-24 / 25-36 paient ×3, et 1-18 / 19-36 paient ×2'
      ],
      en: [
        'Pick your bet: red, black, green (0), even, odd, or a range',
        'Click "Spin" to spin the wheel and ball',
        'The ball lands on a number from 0 to 36',
        'Red/black/even/odd pays ×2',
        'Green (0) pays ×14',
        'Ranges 1-12 / 13-24 / 25-36 pay ×3, and 1-18 / 19-36 pay ×2'
      ]
    },
    payouts: {
      ar: '<tr><td>أحمر (18 رقماً)</td><td>×2</td></tr><tr><td>أسود (18 رقماً)</td><td>×2</td></tr><tr><td>فردي / زوجي</td><td>×2</td></tr><tr><td>1-18 / 19-36</td><td>×2</td></tr><tr><td>1-12 / 13-24 / 25-36</td><td>×3</td></tr><tr><td>أخضر (0)</td><td>×14</td></tr>',
      fr: '<tr><td>Rouge (18 numéros)</td><td>×2</td></tr><tr><td>Noir (18 numéros)</td><td>×2</td></tr><tr><td>Pair / Impair</td><td>×2</td></tr><tr><td>1-18 / 19-36</td><td>×2</td></tr><tr><td>1-12 / 13-24 / 25-36</td><td>×3</td></tr><tr><td>Vert (0)</td><td>×14</td></tr>',
      en: '<tr><td>Red (18 numbers)</td><td>×2</td></tr><tr><td>Black (18 numbers)</td><td>×2</td></tr><tr><td>Even / Odd</td><td>×2</td></tr><tr><td>1-18 / 19-36</td><td>×2</td></tr><tr><td>1-12 / 13-24 / 25-36</td><td>×3</td></tr><tr><td>Green (0)</td><td>×14</td></tr>'
    },
    tips: {
      ar: [
        '18 رقماً أحمر و18 أسود و0 واحد أخضر',
        'الرهانات المزدوجة (أحمر/أسود...) تفوز في 18 من 37 حالة',
        'الـ 0 وحده يعطي الكازينو الأفضلية (18/37 وليس 18/36)'
      ],
      fr: [
        '18 rouges, 18 noirs et un seul vert (0)',
        'Les paris doubles (rouge/noir...) gagnent dans 18 cas sur 37',
        'Le 0 seul donne l\'avantage au casino (18/37 et non 18/36)'
      ],
      en: [
        '18 reds, 18 blacks, and a single green 0',
        'Even-money bets (red/black...) win 18 out of 37 times',
        'The single 0 gives the house its edge (18/37, not 18/36)'
      ]
    }
  },
  /* ═══ Baccarat ═══ */
  bc: {
    name: { ar: 'باكارات', fr: 'Baccarat', en: 'Baccarat' },
    goal: {
      ar: 'راهن على اليد الأقرب إلى 9: اللاعب (×2) أو البنك (×1.95) أو التعادل (×9).',
      fr: 'Pariez sur la main la plus proche de 9 : le joueur (×2), le banquier (×1.95) ou l\'égalité (×9).',
      en: 'Bet on the hand closest to 9: the player (×2), the banker (×1.95), or a tie (×9).'
    },
    steps: {
      ar: [
        'اختر رهانك: Player، Banker، أو Tie',
        'تُوزع ورقتان لكل من Player وBanker',
        'القيمة: الآس = 1، العشرة والصور = 0، الباقي حسب رقمه',
        'مجموع اليد = آخر رقم من مجموع القيم (مثلاً 17 = 7)',
        'اليد الأقرب إلى 9 تفوز — 8 أو 9 طبيعي ينهي الجولة فوراً',
        'اللاعب يسحب ورقة ثالثة إذا كان مجموعه ≤ 5',
        'البنك: يسحب إذا كان مجموعه ≤ 2 دائماً',
        'البنك على 3 يسحب إلا إذا كانت ثالثة اللاعب = 8',
        'البنك على 4 يسحب إذا كانت ثالثة اللاعب بين 2 و7',
        'البنك على 5 يسحب إذا كانت ثالثة اللاعب بين 4 و7',
        'البنك على 6 يسحب إذا كانت ثالثة اللاعب 6 أو 7',
        'البنك على 7 يقف، وبلا ثالثة للاعب يسحب البنك عند 0-5 فقط'
      ],
      fr: [
        'Choisissez votre pari : Player, Banker ou Tie',
        'Le joueur et le banquier reçoivent 2 cartes chacun',
        'Valeurs : As = 1, 10 et figures = 0, sinon la valeur nominale',
        'Total de la main = dernier chiffre de la somme (ex. 17 = 7)',
        'La main la plus proche de 9 gagne — un 8 ou 9 naturel stoppe le tour',
        'Le joueur tire une 3e carte si son total est ≤ 5',
        'Le banquier tire si son total est ≤ 2 (toujours)',
        'Banquier à 3 : tire sauf si la 3e du joueur = 8',
        'Banquier à 4 : tire si la 3e du joueur est entre 2 et 7',
        'Banquier à 5 : tire si la 3e du joueur est entre 4 et 7',
        'Banquier à 6 : tire si la 3e du joueur est 6 ou 7',
        'Banquier à 7 : reste ; sans 3e carte du joueur, tire seulement à 0-5'
      ],
      en: [
        'Pick your bet: Player, Banker, or Tie',
        'Both Player and Banker receive 2 cards each',
        'Values: Ace = 1, 10 and faces = 0, otherwise face value',
        'Hand total = last digit of the sum (e.g. 17 = 7)',
        'The hand closest to 9 wins — a natural 8 or 9 ends the round',
        'The Player draws a 3rd card when their total is ≤ 5',
        'The Banker draws when their total is ≤ 2 (always)',
        'Banker on 3: draws unless the Player 3rd card is 8',
        'Banker on 4: draws when the Player 3rd card is 2-7',
        'Banker on 5: draws when the Player 3rd card is 4-7',
        'Banker on 6: draws when the Player 3rd card is 6 or 7',
        'Banker on 7: stands; with no Player 3rd card, draws only at 0-5'
      ]
    },
    payouts: {
      ar: '<tr><td>Player يفوز</td><td>×2</td></tr><tr><td>Banker يفوز</td><td>×1.95</td></tr><tr><td>تعادل</td><td>×9</td></tr>',
      fr: '<tr><td>Player gagne</td><td>×2</td></tr><tr><td>Banker gagne</td><td>×1.95</td></tr><tr><td>Égalité</td><td>×9</td></tr>',
      en: '<tr><td>Player wins</td><td>×2</td></tr><tr><td>Banker wins</td><td>×1.95</td></tr><tr><td>Tie</td><td>×9</td></tr>'
    },
    tips: {
      ar: [
        'التعادل يدفع ×9 لكن احتمال حدوثه منخفض',
        'Banker يدفع ×1.95 لأنه الأكثر فوزاً قليلاً',
        'تذكر: العشرة والصور = 0 — انتبه للقيم'
      ],
      fr: [
        'L\'égalité paie ×9 mais reste rare',
        'Le Banker paie ×1.95 car il gagne un peu plus souvent',
        'Rappel : 10 et figures = 0 — attention aux valeurs'
      ],
      en: [
        'Tie pays ×9 but is rare',
        'Banker pays ×1.95 because it wins slightly more often',
        'Remember: 10 and faces = 0 — watch the values'
      ]
    }
  },
  /* ═══ Dragon Tiger ═══ */
  dt: {
    name: { ar: 'دراغون تايغر', fr: 'Dragon Tiger', en: 'Dragon Tiger' },
    goal: {
      ar: 'تُسحب بطاقة للتنين وبطاقة للنمر — البطاقة الأعلى قيمة تفوز. تنبأ بالجانب الفائز!',
      fr: 'Une carte est tirée pour le dragon et une pour le tigre — la valeur la plus haute gagne. Devinez le vainqueur !',
      en: 'One card is dealt to the dragon and one to the tiger — the higher value wins. Predict the winner!'
    },
    steps: {
      ar: [
        'اختر رهانك: التنين، النمر، أو تعادل',
        'تُسحب بطاقة واحدة لكل جانب',
        'قارن القيم (الآس أعلى من الملك)',
        'الجانب الأعلى يفوز ×2',
        'تساوي القيم = تعادل ×11'
      ],
      fr: [
        'Choisissez votre pari : Dragon, Tigre ou Égalité',
        'Une carte est tirée pour chaque côté',
        'Comparez les valeurs (l\'As bat le Roi)',
        'Le côté le plus haut gagne ×2',
        'Valeurs égales = égalité ×11'
      ],
      en: [
        'Pick your bet: Dragon, Tiger, or Tie',
        'One card is drawn for each side',
        'Compare the values (Ace beats King)',
        'The higher side wins ×2',
        'Equal values = tie ×11'
      ]
    },
    payouts: {
      ar: '<tr><td>🐉 التنين يفوز</td><td>×2</td></tr><tr><td>🐯 النمر يفوز</td><td>×2</td></tr><tr><td>تعادل (نفس القيمة)</td><td>×11</td></tr>',
      fr: '<tr><td>🐉 Dragon gagne</td><td>×2</td></tr><tr><td>🐯 Tigre gagne</td><td>×2</td></tr><tr><td>Égalité (même valeur)</td><td>×11</td></tr>',
      en: '<tr><td>🐉 Dragon wins</td><td>×2</td></tr><tr><td>🐯 Tiger wins</td><td>×2</td></tr><tr><td>Tie (same value)</td><td>×11</td></tr>'
    },
    tips: {
      ar: [
        'فرصتا التنين والنمر متساويتان تماماً',
        'التعادل نادر ويستحق ×11 — مغري لكنه محفوف بالمخاطر',
        'لا توجد استراتيجية تتبع بطاقات هنا'
      ],
      fr: [
        'Dragon et Tigre ont exactement les mêmes chances',
        'L\'égalité est rare et paie ×11 — tentant mais risqué',
        'Aucune stratégie de comptage de cartes ici'
      ],
      en: [
        'Dragon and Tiger have exactly equal chances',
        'Tie is rare and pays ×11 — tempting but risky',
        'No card-counting strategy applies here'
      ]
    }
  },
  /* ═══ Video Poker ═══ */
  vp: {
    name: { ar: 'فيديو بوكر', fr: 'Video Poker', en: 'Video Poker' },
    goal: {
      ar: 'كوّن أفضل يد بوكر من 5 بطاقات. احتفظ بالبطاقات الجيدة وأعد سحب الباقي — الأيدي الأعلى تدفع أكثر!',
      fr: 'Formez la meilleure main de poker avec 5 cartes. Gardez les bonnes cartes et remplacez le reste — les meilleures mains paient plus !',
      en: 'Make the best 5-card poker hand. Hold the good cards and redraw the rest — better hands pay more!'
    },
    steps: {
      ar: [
        'اضغط "توزيع" لسحب 5 بطاقات',
        'اضغط على أي بطاقة لتمييزها "احتفاظ" (أو أزل التمييز)',
        'اضغط "سحب" لاستبدال البطاقات غير المحتفظ بها',
        'تُقيَّم اليد النهائية حسب جدول الدفع',
        'زوج من J أو أعلى يبدأ الدفع'
      ],
      fr: [
        'Cliquez sur "Distribuer" pour recevoir 5 cartes',
        'Cliquez sur une carte pour la garder (ou retirer le marquage)',
        'Cliquez sur "Piocher" pour remplacer les autres',
        'La main finale est évaluée selon le tableau',
        'Une paire de Valets ou plus commence à payer'
      ],
      en: [
        'Click "Deal" to receive 5 cards',
        'Click a card to mark it as "held" (or unmark it)',
        'Click "Draw" to replace the unheld cards',
        'The final hand is rated by the pay table',
        'A pair of Jacks or higher starts paying'
      ]
    },
    payouts: {
      ar: '<tr><td>Royal Flush</td><td>×250</td></tr><tr><td>Straight Flush</td><td>×50</td></tr><tr><td>Four of a Kind</td><td>×25</td></tr><tr><td>Full House</td><td>×9</td></tr><tr><td>Flush</td><td>×6</td></tr><tr><td>Straight</td><td>×4</td></tr><tr><td>Three of a Kind</td><td>×3</td></tr><tr><td>Two Pair</td><td>×2</td></tr><tr><td>Jacks or Better (زوج J فأعلى)</td><td>×1</td></tr>',
      fr: '<tr><td>Royal Flush</td><td>×250</td></tr><tr><td>Quinte Flush</td><td>×50</td></tr><tr><td>Carré</td><td>×25</td></tr><tr><td>Full House</td><td>×9</td></tr><tr><td>Couleur</td><td>×6</td></tr><tr><td>Quinte</td><td>×4</td></tr><tr><td>Brelan</td><td>×3</td></tr><tr><td>Deux paires</td><td>×2</td></tr><tr><td>Jacks or Better (paire de Valets ou plus)</td><td>×1</td></tr>',
      en: '<tr><td>Royal Flush</td><td>×250</td></tr><tr><td>Straight Flush</td><td>×50</td></tr><tr><td>Four of a Kind</td><td>×25</td></tr><tr><td>Full House</td><td>×9</td></tr><tr><td>Flush</td><td>×6</td></tr><tr><td>Straight</td><td>×4</td></tr><tr><td>Three of a Kind</td><td>×3</td></tr><tr><td>Two Pair</td><td>×2</td></tr><tr><td>Jacks or Better (pair of 10 or higher)</td><td>×1</td></tr>'
    },
    tips: {
      ar: [
        'احتفظ دائماً بزوج J+ أو بأي سحب قوي',
        'احتفظ بالبطاقات العالية (10-A) من نفس اللون لاصطياد Flush',
        'Royal Flush يدفع ×250 — لا تهمل بطاقاته'
      ],
      fr: [
        'Gardez toujours une paire de J+ ou un bon tirage',
        'Gardez les hautes cartes (10-A) de même couleur pour viser la quinte flush',
        'La Royal Flush paie ×250 — gardez ses cartes'
      ],
      en: [
        'Always hold a pair of J+ or a strong draw',
        'Hold high cards (10-A) of the same suit to chase a flush',
        'Royal Flush pays ×250 — keep its cards'
      ]
    }
  },
  /* ═══ Keno ═══ */
  ke: {
    name: { ar: 'كينو', fr: 'Keno', en: 'Keno' },
    goal: {
      ar: 'اختر من 1 إلى 10 أرقام من 1 إلى 80. يُسحب 20 رقماً عشوائياً — كلما زادت مطابقاتك، زاد المضاعف!',
      fr: 'Choisissez 1 à 10 numéros de 1 à 80. 20 numéros sont tirés au hasard — plus de correspondances, plus le multiplicateur est élevé !',
      en: 'Pick 1 to 10 numbers from 1 to 80. 20 numbers are drawn at random — the more matches, the higher the multiplier!'
    },
    steps: {
      ar: [
        'اضغط على الأرقام لتحديدها (من 1 إلى 10 أرقام)',
        'اضغط "سحب!" لبدء القرعة — يُخصم الرهان',
        'يُسحب 20 رقماً من 1 إلى 80 بالتتابع',
        'تُحتسب مطابقاتك مع الأرقام المسحوبة',
        'المضاعف حسب عدد المطابقات وعدد الأرقام المختارة (RTP ≈ 95%)'
      ],
      fr: [
        'Cliquez sur les numéros pour les choisir (1 à 10)',
        'Cliquez sur "Tirer !" pour lancer le tirage — la mise est déduite',
        '20 numéros sont tirés de 1 à 80 un par un',
        'Vos correspondances avec les numéros tirés sont comptées',
        'Le multiplicateur dépend des correspondances et du nombre choisi (RTP ≈ 95%)'
      ],
      en: [
        'Click numbers to select them (1 to 10)',
        'Click "DRAW!" to start the draw — the bet is deducted',
        '20 numbers are drawn from 1 to 80 one by one',
        'Your matches with the drawn numbers are counted',
        'The multiplier depends on matches and numbers picked (RTP ≈ 95%)'
      ]
    },
    payouts: {
      ar: '<tr><th colspan="2">مضاعفات الرهان (GB)</th></tr><tr><td><b>1</b> رقم: 1 → ×3.8</td></tr><tr><td><b>2</b> رقمان: 1 → ×1 · 2 → ×10</td></tr><tr><td><b>3</b> أرقام: 2 → ×3 · 3 → ×38</td></tr><tr><td><b>4</b> أرقام: 2 → ×1 · 3 → ×9 · 4 → ×100</td></tr><tr><td><b>5</b> أرقام: 3 → ×4 · 4 → ×26 · 5 → ×448</td></tr><tr><td><b>6</b> أرقام: 3 → ×2 · 4 → ×9 · 5 → ×85 · 6 → ×1324</td></tr><tr><td><b>7</b> أرقام: 4 → ×6 · 5 → ×39 · 6 → ×270 · 7 → ×4199</td></tr><tr><td><b>8</b> أرقام: 4 → ×3 · 5 → ×18 · 6 → ×98 · 7 → ×684 · 8 → ×8924</td></tr><tr><td><b>9</b> أرقام: 5 → ×10 · 6 → ×63 · 7 → ×313 · 8 → ×2170 · 9 → ×28930</td></tr><tr><td><b>10</b> أرقام: 5 → ×5 · 6 → ×28 · 7 → ×154 · 8 → ×794 · 9 → ×4205 · 10 → ×56061</td></tr>',
      fr: '<tr><th colspan="2">Multiplicateurs de la mise (GB)</th></tr><tr><td><b>1</b> numéro : 1 → ×3,8</td></tr><tr><td><b>2</b> numéros : 1 → ×1 · 2 → ×10</td></tr><tr><td><b>3</b> numéros : 2 → ×3 · 3 → ×38</td></tr><tr><td><b>4</b> numéros : 2 → ×1 · 3 → ×9 · 4 → ×100</td></tr><tr><td><b>5</b> numéros : 3 → ×4 · 4 → ×26 · 5 → ×448</td></tr><tr><td><b>6</b> numéros : 3 → ×2 · 4 → ×9 · 5 → ×85 · 6 → ×1324</td></tr><tr><td><b>7</b> numéros : 4 → ×6 · 5 → ×39 · 6 → ×270 · 7 → ×4199</td></tr><tr><td><b>8</b> numéros : 4 → ×3 · 5 → ×18 · 6 → ×98 · 7 → ×684 · 8 → ×8924</td></tr><tr><td><b>9</b> numéros : 5 → ×10 · 6 → ×63 · 7 → ×313 · 8 → ×2170 · 9 → ×28930</td></tr><tr><td><b>10</b> numéros : 5 → ×5 · 6 → ×28 · 7 → ×154 · 8 → ×794 · 9 → ×4205 · 10 → ×56061</td></tr>',
      en: '<tr><th colspan="2">Bet multipliers (GB)</th></tr><tr><td><b>1</b> number: 1 → ×3.8</td></tr><tr><td><b>2</b> numbers: 1 → ×1 · 2 → ×10</td></tr><tr><td><b>3</b> numbers: 2 → ×3 · 3 → ×38</td></tr><tr><td><b>4</b> numbers: 2 → ×1 · 3 → ×9 · 4 → ×100</td></tr><tr><td><b>5</b> numbers: 3 → ×4 · 4 → ×26 · 5 → ×448</td></tr><tr><td><b>6</b> numbers: 3 → ×2 · 4 → ×9 · 5 → ×85 · 6 → ×1324</td></tr><tr><td><b>7</b> numbers: 4 → ×6 · 5 → ×39 · 6 → ×270 · 7 → ×4199</td></tr><tr><td><b>8</b> numbers: 4 → ×3 · 5 → ×18 · 6 → ×98 · 7 → ×684 · 8 → ×8924</td></tr><tr><td><b>9</b> numbers: 5 → ×10 · 6 → ×63 · 7 → ×313 · 8 → ×2170 · 9 → ×28930</td></tr><tr><td><b>10</b> numbers: 5 → ×5 · 6 → ×28 · 7 → ×154 · 8 → ×794 · 9 → ×4205 · 10 → ×56061</td></tr>'
    },
    tips: {
      ar: [
        'المزيد من الأرقام المختارة = فرصة أكبر لكن تقلب أعلى',
        'عدد قليل من المطابقات بالكاد يغطي الرهان',
        'لعبة حظ خالص — اختر أرقامك المفضلة'
      ],
      fr: [
        'Plus de numéros choisis = plus de chances mais plus de variance',
        'Peu de correspondances couvrent à peine le pari',
        'Jeu de pur hasard — choisissez vos numéros favoris'
      ],
      en: [
        'More numbers picked = more chances but higher variance',
        'Few matches barely cover your bet',
        'Pure luck game — pick your favorite numbers'
      ]
    }
  },
  /* ═══ Andar Bahar ═══ */
  ab: {
    name: { ar: 'أندار باهار', fr: 'Andar Bahar', en: 'Andar Bahar' },
    goal: {
      ar: 'تُسحب بطاقة "Joker" ثم تُوزع البطاقات بالتناوب بين Andar وBahar. الجانب الذي تظهر فيه بطاقة بنفس رتبة الـ Joker أولاً يفوز.',
      fr: 'Une carte "Joker" est tirée, puis les cartes sont distribuées en alternance entre Andar et Bahar. Le côté où la carte de même rang apparaît en premier gagne.',
      en: 'A "Joker" card is drawn, then cards are dealt alternately to Andar and Bahar. The side where a matching-rank card appears first wins.'
    },
    steps: {
      ar: [
        'اختر الجانب: Andar أو Bahar (×1.9 لكلا الجانبين)',
        'تُسحب بطاقة Joker وتُعرض في الأعلى',
        'تُوزع البطاقات بالتناوب: Andar ثم Bahar ثم Andar...',
        'أول جانب تظهر فيه بطاقة بنفس رتبة الـ Joker يفوز',
        'الجانب الفائز يدفع ×1.9 — الربح يُحتسب من الرهان'
      ],
      fr: [
        'Choisissez votre côté : Andar ou Bahar (×1,9 des deux côtés)',
        'Une carte Joker est tirée et affichée en haut',
        'Les cartes sont distribuées en alternance : Andar, puis Bahar, puis Andar...',
        'Le premier côté où apparaît une carte du même rang que le Joker gagne',
        'Le côté gagnant paie ×1,9 — le gain est calculé sur la mise'
      ],
      en: [
        'Pick your side: Andar or Bahar (×1.9 on both sides)',
        'A Joker card is drawn and shown on top',
        'Cards are dealt alternately: Andar, then Bahar, then Andar...',
        'The first side to show a card matching the Joker\'s rank wins',
        'The winning side pays ×1.9 — payout is based on the bet'
      ]
    },
    payouts: {
      ar: '<tr><td>Andar يفوز</td><td>×1.9</td></tr><tr><td>Bahar يفوز</td><td>×1.9</td></tr>',
      fr: '<tr><td>Andar gagne</td><td>×1,9</td></tr><tr><td>Bahar gagne</td><td>×1,9</td></tr>',
      en: '<tr><td>Andar wins</td><td>×1.9</td></tr><tr><td>Bahar wins</td><td>×1.9</td></tr>'
    },
    tips: {
      ar: [
        'كلا الجانبين يدفع ×1.9 — ميزة الكازينو 5% (RTP 95%)',
        'Andar يُوزّع أولاً لكن الاحتمالات متساوية عملياً',
        'لا توجد طريقة لمعرفة موضع البطاقة المطابقة مسبقاً'
      ],
      fr: [
        'Les deux côtés paient ×1,9 — avantage du casino 5 % (RTP 95 %)',
        'Andar reçoit la première carte, mais les probabilités sont quasi égales',
        'Aucun moyen de connaître la position de la carte correspondante'
      ],
      en: [
        'Both sides pay ×1.9 — house edge 5% (RTP 95%)',
        'Andar is dealt first, but the odds are virtually equal',
        'There is no way to know the matching card\'s position in advance'
      ]
    }
  },
  /* ═══ Crabbin ═══ */
  crabbin: {
    name: { ar: 'كريبن', fr: 'Crabbin', en: 'Crabbin' },
    goal: {
      ar: 'اضغط ابدأ ثم اختر سلطعوناً واحداً من 9. سلطعون ذهبي يربح بمضاعفه، وسلطعون أحمر يُخسر الرهان.',
      fr: 'Appuyez sur Démarrer puis choisissez un crabe parmi 9. Un crabe doré gagne son multiplicateur, un crabe rouge fait perdre la mise.',
      en: 'Press Start then pick one crab out of 9. A golden crab pays its multiplier, a red crab loses the bet.'
    },
    steps: {
      ar: ['اضغط زر «ابدأ الصيد» (يُسحب الرهان)', 'اختر أي سلطعون من الشبكة 3×3', 'تُكشف كل الخلايا: الذهبية ربح والحمراء خسارة', 'الذهب ×1.3/×1.4/×1.5/×1.6 حسب الخلية', 'الخسارة = فقدان الرهان كاملاً'],
      fr: ['Appuyez sur « Commencer » (la mise est débitée)', 'Choisissez n\'importe quel crabe de la grille 3×3', 'Toutes les cellules sont révélées : dorées gagnent, rouges perdent', 'Or ×1,3/×1,4/×1,5/×1,6 selon la cellule', 'Perdre = la mise entière est perdue'],
      en: ['Press the Start button (bet is taken)', 'Pick any crab from the 3×3 grid', 'All cells are revealed: golden win, red lose', 'Gold ×1.3/×1.4/×1.5/×1.6 depending on the cell', 'Losing = the whole bet is lost']
    },
    payouts: {
      ar: '<tr><td>سلطعون ذهبي ×1.3</td><td>×1.3</td></tr><tr><td>سلطعون ذهبي ×1.4</td><td>×1.4</td></tr><tr><td>سلطعون ذهبي ×1.5</td><td>×1.5</td></tr><tr><td>سلطعون ذهبي ×1.6</td><td>×1.6</td></tr><tr><td>سلطعون أحمر</td><td>×0</td></tr>',
      fr: '<tr><td>Crabe doré ×1,3</td><td>×1,3</td></tr><tr><td>Crabe doré ×1,4</td><td>×1,4</td></tr><tr><td>Crabe doré ×1,5</td><td>×1,5</td></tr><tr><td>Crabe doré ×1,6</td><td>×1,6</td></tr><tr><td>Crabe rouge</td><td>×0</td></tr>',
      en: '<tr><td>Golden crab ×1.3</td><td>×1.3</td></tr><tr><td>Golden crab ×1.4</td><td>×1.4</td></tr><tr><td>Golden crab ×1.5</td><td>×1.5</td></tr><tr><td>Golden crab ×1.6</td><td>×1.6</td></tr><tr><td>Red crab</td><td>×0</td></tr>'
    },
    tips: {
      ar: ['6 خلايا ذهبية من أصل 9 — احتمال الفوز 66.7%', 'المضاعفات 1.3، 1.3، 1.4، 1.4، 1.5، 1.6 (متوسط 1.42)', 'RTP 94.4% — ميزة الكازينو 5.6%'],
      fr: ['6 cellules dorées sur 9 — probabilité de gain 66,7 %', 'Multiplicateurs 1,3, 1,3, 1,4, 1,4, 1,5, 1,6 (moyenne 1,42)', 'RTP 94,4 % — avantage du casino 5,6 %'],
      en: ['6 golden cells out of 9 — win chance 66.7%', 'Multipliers 1.3, 1.3, 1.4, 1.4, 1.5, 1.6 (avg 1.42)', 'RTP 94.4% — house edge 5.6%']
    }
  },
  /* ═══ Fishing ═══ */
  fishing: {
    name: { ar: 'فيشينغ', fr: 'Fishing', en: 'Fishing' },
    goal: {
      ar: 'اختر سمكة وأطلق القذيفة. كل سمكة لها مضاعف واحتمال اصطياد: كلما كبر المضاعف قلّ الاحتمال.',
      fr: 'Choisissez un poisson et tirez. Chaque poisson a un multiplicateur et une probabilité de prise : plus le multiplicateur est grand, moins la probabilité est élevée.',
      en: 'Pick a fish and fire. Each fish has a multiplier and a catch chance: the bigger the multiplier, the lower the chance.'
    },
    steps: {
      ar: ['اختر إحدى السمكات الخمس', 'القذيفة تنطلق ويُحدَّد الاصطياد فوراً', 'اصطياد = ربح الرهان × المضاعف', 'هروب = خسارة الرهان'],
      fr: ['Choisissez l\'un des cinq poissons', 'Le boulet part et la prise est déterminée immédiatement', 'Prise = mise × multiplicateur', 'Évasion = mise perdue'],
      en: ['Pick one of the five fish', 'The shot fires and the catch is decided instantly', 'Catch = bet × multiplier', 'Escape = bet lost']
    },
    payouts: {
      ar: '<tr><td>سردين 🐟</td><td>×1.1 (90%)</td></tr><tr><td>دوراد 🐠</td><td>×1.3 (75%)</td></tr><tr><td>فوغو 🐡</td><td>×1.6 (60%)</td></tr><tr><td>أخطبوط 🐙</td><td>×2 (40%)</td></tr><tr><td>قرش 🦈</td><td>×3 (35%)</td></tr>',
      fr: '<tr><td>Sardine 🐟</td><td>×1,1 (90 %)</td></tr><tr><td>Dorade 🐠</td><td>×1,3 (75 %)</td></tr><tr><td>Fugu 🐡</td><td>×1,6 (60 %)</td></tr><tr><td>Poulpe 🐙</td><td>×2 (40 %)</td></tr><tr><td>Requin 🦈</td><td>×3 (35 %)</td></tr>',
      en: '<tr><td>Sardine 🐟</td><td>×1.1 (90%)</td></tr><tr><td>Dorade 🐠</td><td>×1.3 (75%)</td></tr><tr><td>Fugu 🐡</td><td>×1.6 (60%)</td></tr><tr><td>Octopus 🐙</td><td>×2 (40%)</td></tr><tr><td>Shark 🦈</td><td>×3 (35%)</td></tr>'
    },
    tips: {
      ar: ['كل سمكة تُعرض مضاعفها قبل الإطلاق', 'الأسماك الكبيرة تجازف أكثر — احتمال أقل', 'RTP 95.5% — ميزة الكازينو 4.5%'],
      fr: ['Chaque poisson affiche son multiplicateur avant le tir', 'Les gros poissons risquent plus — probabilité plus faible', 'RTP 95,5 % — avantage du casino 4,5 %'],
      en: ['Each fish shows its multiplier before firing', 'Big fish risk more — lower chance', 'RTP 95.5% — house edge 4.5%']
    }
  },
  /* ═══ Gates ═══ */
  gates: {
    name: { ar: 'بوابات زيوس', fr: 'Portes de Zeus', en: 'Gates of Zeus' },
    goal: {
      ar: 'اضغط ابدأ ثم افتح بوابة واحدة من أربع. ثلاث بوابات ذهبية تكافئك بمضاعفها وبوابة ملعونة تُخسر الرهان.',
      fr: 'Appuyez sur Démarrer puis ouvrez une porte parmi quatre. Trois portes dorées récompensent de leur multiplicateur, une porte maudite fait perdre la mise.',
      en: 'Press Start then open one of four gates. Three golden gates pay their multiplier, one cursed gate loses the bet.'
    },
    steps: {
      ar: ['اضغط زر «افتح البوابات» (يُسحب الرهان)', 'اختر إحدى البوابات الأربع', 'تُكشف البوابات: ذهبية 🗿 ربح / ملعونة 💀 خسارة', 'المضاعفات: ×1.2 / ×1.3 / ×1.3'],
      fr: ['Appuyez sur « Ouvrir les portes » (la mise est débitée)', 'Choisissez l\'une des quatre portes', 'Les portes sont révélées : dorée 🗿 gagne / maudite 💀 perd', 'Multiplicateurs : ×1,2 / ×1,3 / ×1,3'],
      en: ['Press Open gates (bet is taken)', 'Pick one of the four gates', 'Gates are revealed: golden 🗿 wins / cursed 💀 loses', 'Multipliers: ×1.2 / ×1.3 / ×1.3']
    },
    payouts: {
      ar: '<tr><td>بوابة ذهبية</td><td>×1.2 / ×1.3</td></tr><tr><td>بوابة ملعونة</td><td>×0</td></tr>',
      fr: '<tr><td>Porte dorée</td><td>×1,2 / ×1,3</td></tr><tr><td>Porte maudite</td><td>×0</td></tr>',
      en: '<tr><td>Golden gate</td><td>×1.2 / ×1.3</td></tr><tr><td>Cursed gate</td><td>×0</td></tr>'
    },
    tips: {
      ar: ['3 بوابات مربحة من أصل 4 — احتمال الفوز 75%', 'المتوسط المرجح ×1.27 لكل بوابة', 'RTP 95% — ميزة الكازينو 5%'],
      fr: ['3 portes gagnantes sur 4 — probabilité de gain 75 %', 'Moyenne pondérée ×1,27 par porte', 'RTP 95 % — avantage du casino 5 %'],
      en: ['3 winning gates out of 4 — win chance 75%', 'Weighted average ×1.27 per gate', 'RTP 95% — house edge 5%']
    }
  },
  /* ═══ Lightning ═══ */
  lightning: {
    name: { ar: 'لايتنينغ', fr: 'Lightning', en: 'Lightning' },
    goal: {
      ar: 'اضغط ابدأ ثم اختر شرارة واحدة من 12. تسع برقات ذهبية تربح بمضاعفها وثلاث عواصف تُخسر الرهان.',
      fr: 'Appuyez sur Démarrer puis choisissez une étincelle parmi 12. Neuf éclairs dorés gagnent leur multiplicateur, trois tempêtes font perdre la mise.',
      en: 'Press Start then pick one spark out of 12. Nine golden bolts pay their multiplier, three storms lose the bet.'
    },
    steps: {
      ar: ['اضغط زر «أطلق البرق» (يُسحب الرهان)', 'اختر أي خلية برق من الشبكة', 'تُكشف كل الخلايا: برق ذهبي ⚡ ربح / عاصفة 🌩️ خسارة', 'المضاعفات: ×1.1 حتى ×1.5'],
      fr: ['Appuyez sur « Lancer l\'éclair » (la mise est débitée)', 'Choisissez n\'importe quelle cellule d\'éclair', 'Toutes les cellules sont révélées : éclair doré ⚡ gagne / tempête 🌩️ perd', 'Multiplicateurs : ×1,1 à ×1,5'],
      en: ['Press Strike (bet is taken)', 'Pick any lightning cell', 'All cells are revealed: golden bolt ⚡ wins / storm 🌩️ loses', 'Multipliers: ×1.1 up to ×1.5']
    },
    payouts: {
      ar: '<tr><td>برق ذهبي ×1.1 / ×1.2 / ×1.3 / ×1.4 / ×1.5</td><td>×1.1-×1.5</td></tr><tr><td>عاصفة</td><td>×0</td></tr>',
      fr: '<tr><td>Éclair doré ×1,1 / ×1,2 / ×1,3 / ×1,4 / ×1,5</td><td>×1,1-×1,5</td></tr><tr><td>Tempête</td><td>×0</td></tr>',
      en: '<tr><td>Golden bolt ×1.1 / ×1.2 / ×1.3 / ×1.4 / ×1.5</td><td>×1.1-×1.5</td></tr><tr><td>Storm</td><td>×0</td></tr>'
    },
    tips: {
      ar: ['9 خلايا رابحة من أصل 12 — احتمال الفوز 75%', 'مجموع المضاعفات 11.5 عبر 12 خلية', 'RTP 95.8% — ميزة الكازينو 4.2%'],
      fr: ['9 cellules gagnantes sur 12 — probabilité de gain 75 %', 'Total des multiplicateurs 11,5 sur 12 cellules', 'RTP 95,8 % — avantage du casino 4,2 %'],
      en: ['9 winning cells out of 12 — win chance 75%', 'Multiplier total 11.5 across 12 cells', 'RTP 95.8% — house edge 4.2%']
    }
  },
  /* ═══ Lottery ═══ */
  lottery: {
    name: { ar: 'لوترية', fr: 'Lottery', en: 'Lottery' },
    goal: {
      ar: 'اضغط ابدأ ثم اختر تذكرة واحدة من 6. ثلاث تذاكر رابحة بمضاعفات ×1.4/×1.9/×2.4 وثلاث فارغة.',
      fr: 'Appuyez sur Démarrer puis choisissez un billet parmi 6. Trois billets gagnants ×1,4/×1,9/×2,4 et trois vides.',
      en: 'Press Start then pick one ticket out of 6. Three winning tickets ×1.4/×1.9/×2.4 and three empty.'
    },
    steps: {
      ar: ['اضغط زر «اسحب تذكرة» (يُسحب الرهان)', 'اختر إحدى التذاكر الست', 'تُكشف التذاكر: ذهبية ربح / حمراء فارغة', 'الجوائز: ×1.4 / ×1.9 / ×2.4'],
      fr: ['Appuyez sur « Tirer un billet » (la mise est débitée)', 'Choisissez l\'un des six billets', 'Les billets sont révélés : dorés gagnent / rouges vides', 'Prix : ×1,4 / ×1,9 / ×2,4'],
      en: ['Press Draw ticket (bet is taken)', 'Pick one of the six tickets', 'Tickets are revealed: golden win / red empty', 'Prizes: ×1.4 / ×1.9 / ×2.4']
    },
    payouts: {
      ar: '<tr><td>تذكرة ذهبية</td><td>×1.4 / ×1.9 / ×2.4</td></tr><tr><td>تذكرة فارغة</td><td>×0</td></tr>',
      fr: '<tr><td>Billet doré</td><td>×1,4 / ×1,9 / ×2,4</td></tr><tr><td>Billet vide</td><td>×0</td></tr>',
      en: '<tr><td>Golden ticket</td><td>×1.4 / ×1.9 / ×2.4</td></tr><tr><td>Empty ticket</td><td>×0</td></tr>'
    },
    tips: {
      ar: ['3 تذاكر رابحة من أصل 6 — احتمال الفوز 50%', 'مجموع الجوائز 5.7 عبر 6 تذاكر', 'RTP 95% — ميزة الكازينو 5%'],
      fr: ['3 billets gagnants sur 6 — probabilité de gain 50 %', 'Total des prix 5,7 sur 6 billets', 'RTP 95 % — avantage du casino 5 %'],
      en: ['3 winning tickets out of 6 — win chance 50%', 'Prize total 5.7 across 6 tickets', 'RTP 95% — house edge 5%']
    }
  },
  /* ═══ Mahjong ═══ */
  mahjong: {
    name: { ar: 'ماهجونغ', fr: 'Mahjong', en: 'Mahjong' },
    goal: {
      ar: 'اضغط ابدأ ثم اختر بلاطة واحدة من 12. ثماني بلاطات ذهبية 🀄 تربح بمضاعفها وأربع حمراء 🀆 تُخسر الرهان.',
      fr: 'Appuyez sur Démarrer puis choisissez une tuile parmi 12. Huit tuiles dorées 🀄 gagnent leur multiplicateur, quatre rouges 🀆 font perdre la mise.',
      en: 'Press Start then pick one tile out of 12. Eight golden tiles 🀄 pay their multiplier, four red tiles 🀆 lose the bet.'
    },
    steps: {
      ar: ['اضغط زر «اقلب البلاطات» (يُسحب الرهان)', 'اختر أي بلاطة من الشبكة 4×3', 'تُكشف البلاطات: ذهبية 🀄 ربح / حمراء 🀆 خسارة', 'المضاعفات: ×1.3 حتى ×1.6'],
      fr: ['Appuyez sur « Retourner les tuiles » (la mise est débitée)', 'Choisissez n\'importe quelle tuile de la grille 4×3', 'Les tuiles sont révélées : dorées 🀄 gagnent / rouges 🀆 perdent', 'Multiplicateurs : ×1,3 à ×1,6'],
      en: ['Press Flip tiles (bet is taken)', 'Pick any tile from the 4×3 grid', 'Tiles are revealed: golden 🀄 win / red 🀆 lose', 'Multipliers: ×1.3 up to ×1.6']
    },
    payouts: {
      ar: '<tr><td>بلاطة ذهبية ×1.3 / ×1.4 / ×1.5 / ×1.6</td><td>×1.3-×1.6</td></tr><tr><td>بلاطة حمراء</td><td>×0</td></tr>',
      fr: '<tr><td>Tuile dorée ×1,3 / ×1,4 / ×1,5 / ×1,6</td><td>×1,3-×1,6</td></tr><tr><td>Tuile rouge</td><td>×0</td></tr>',
      en: '<tr><td>Golden tile ×1.3 / ×1.4 / ×1.5 / ×1.6</td><td>×1.3-×1.6</td></tr><tr><td>Red tile</td><td>×0</td></tr>'
    },
    tips: {
      ar: ['8 بلاطات رابحة من أصل 12 — احتمال الفوز 66.7%', 'مجموع المضاعفات 11.4 عبر 12 بلاطة', 'RTP 95% — ميزة الكازينو 5%'],
      fr: ['8 tuiles gagnantes sur 12 — probabilité de gain 66,7 %', 'Total des multiplicateurs 11,4 sur 12 tuiles', 'RTP 95 % — avantage du casino 5 %'],
      en: ['8 winning tiles out of 12 — win chance 66.7%', 'Multiplier total 11.4 across 12 tiles', 'RTP 95% — house edge 5%']
    }
  },
  /* ═══ Money ═══ */
  money: {
    name: { ar: 'خزائن المال', fr: 'Money Safes', en: 'Money Safes' },
    goal: {
      ar: 'اضغط ابدأ ثم اختر خزنة واحدة من 9. ست خزائن ذهبية 🔒 تكشف كنزها 🪙 وثلاث قنابل 💥 تُخسر الرهان.',
      fr: 'Appuyez sur Démarrer puis choisissez un coffre parmi 9. Six coffres dorés 🔒 révèlent leur trésor 🪙, trois bombes 💥 font perdre la mise.',
      en: 'Press Start then pick one safe out of 9. Six golden safes 🔒 reveal their treasure 🪙, three bombs 💥 lose the bet.'
    },
    steps: {
      ar: ['اضغط زر «افتح الخزائن» (يُسحب الرهان)', 'اختر أي خزنة من الشبكة 3×3', 'تُكشف الخزائن: ذهبية 🔒→🪙 ربح / قنبلة 💥 خسارة', 'المضاعفات: ×1.3 حتى ×1.6'],
      fr: ['Appuyez sur « Ouvrir les coffres » (la mise est débitée)', 'Choisissez n\'importe quel coffre de la grille 3×3', 'Les coffres sont révélés : dorés 🔒→🪙 gagnent / bombe 💥 perd', 'Multiplicateurs : ×1,3 à ×1,6'],
      en: ['Press Open safes (bet is taken)', 'Pick any safe from the 3×3 grid', 'Safes are revealed: golden 🔒→🪙 win / bomb 💥 loses', 'Multipliers: ×1.3 up to ×1.6']
    },
    payouts: {
      ar: '<tr><td>خزنة ذهبية ×1.3 / ×1.4 / ×1.5 / ×1.6</td><td>×1.3-×1.6</td></tr><tr><td>قنبلة</td><td>×0</td></tr>',
      fr: '<tr><td>Coffre doré ×1,3 / ×1,4 / ×1,5 / ×1,6</td><td>×1,3-×1,6</td></tr><tr><td>Bombe</td><td>×0</td></tr>',
      en: '<tr><td>Golden safe ×1.3 / ×1.4 / ×1.5 / ×1.6</td><td>×1.3-×1.6</td></tr><tr><td>Bomb</td><td>×0</td></tr>'
    },
    tips: {
      ar: ['6 خزائن رابحة من أصل 9 — احتمال الفوز 66.7%', 'مجموع المضاعفات 8.5 عبر 9 خزائن', 'RTP 94.4% — ميزة الكازينو 5.6%'],
      fr: ['6 coffres gagnants sur 9 — probabilité de gain 66,7 %', 'Total des multiplicateurs 8,5 sur 9 coffres', 'RTP 94,4 % — avantage du casino 5,6 %'],
      en: ['6 winning safes out of 9 — win chance 66.7%', 'Multiplier total 8.5 across 9 safes', 'RTP 94.4% — house edge 5.6%']
    }
  },
  /* ═══ Olympus ═══ */
  olympus: {
    name: { ar: 'أوليمبوس', fr: 'Olympus', en: 'Olympus' },
    goal: {
      ar: 'اضغط ابدأ ثم اختر إلهاً واحداً من أربعة. ثلاثة آلهة ذهبية 🏛️ تُطلق البرق ⚡ والإله الملعون 💀 يُخسر الرهان.',
      fr: 'Appuyez sur Démarrer puis choisissez un dieu parmi quatre. Trois dieux dorés 🏛️ lancent l\'éclair ⚡, le dieu maudit 💀 fait perdre la mise.',
      en: 'Press Start then pick one god out of four. Three golden gods 🏛️ strike lightning ⚡, the cursed god 💀 loses the bet.'
    },
    steps: {
      ar: ['اضغط زر «استدعِ الآلهة» (يُسحب الرهان)', 'اختر إحدى الآلهة الأربع', 'تُكشف الآلهة: ذهبية 🏛️→⚡ ربح / ملعونة 💀 خسارة', 'المضاعفات: ×1.2 / ×1.3 / ×1.3'],
      fr: ['Appuyez sur « Invoquer les dieux » (la mise est débitée)', 'Choisissez l\'un des quatre dieux', 'Les dieux sont révélés : dorés 🏛️→⚡ gagnent / maudit 💀 perd', 'Multiplicateurs : ×1,2 / ×1,3 / ×1,3'],
      en: ['Press Summon gods (bet is taken)', 'Pick one of the four gods', 'Gods are revealed: golden 🏛️→⚡ win / cursed 💀 loses', 'Multipliers: ×1.2 / ×1.3 / ×1.3']
    },
    payouts: {
      ar: '<tr><td>إله ذهبي</td><td>×1.2 / ×1.3</td></tr><tr><td>إله ملعون</td><td>×0</td></tr>',
      fr: '<tr><td>Dieu doré</td><td>×1,2 / ×1,3</td></tr><tr><td>Dieu maudit</td><td>×0</td></tr>',
      en: '<tr><td>Golden god</td><td>×1.2 / ×1.3</td></tr><tr><td>Cursed god</td><td>×0</td></tr>'
    },
    tips: {
      ar: ['3 آلهة رابحة من أصل 4 — احتمال الفوز 75%', 'مجموع المضاعفات 3.8 عبر 4 آلهة', 'RTP 95% — ميزة الكازينو 5%'],
      fr: ['3 dieux gagnants sur 4 — probabilité de gain 75 %', 'Total des multiplicateurs 3,8 sur 4 dieux', 'RTP 95 % — avantage du casino 5 %'],
      en: ['3 winning gods out of 4 — win chance 75%', 'Multiplier total 3.8 across 4 gods', 'RTP 95% — house edge 5%']
    }
  },
  /* ═══ Poker ═══ */
  poker: {
    name: { ar: 'بوكر', fr: 'Poker', en: 'Poker' },
    goal: {
      ar: 'اضغط ابدأ ثم اختر بطاقة واحدة من خمس. ثلاث بطاقات ملكية A♠/K♥/Q♦ تربح بمضاعفها وبطاقتان منخفضتان 2♣ تُخسران الرهان.',
      fr: 'Appuyez sur Démarrer puis choisissez une carte parmi cinq. Trois cartes royales A♠/K♥/Q♦ gagnent leur multiplicateur, deux cartes basses 2♣ font perdre la mise.',
      en: 'Press Start then pick one card out of five. Three royal cards A♠/K♥/Q♦ pay their multiplier, two low cards 2♣ lose the bet.'
    },
    steps: {
      ar: ['اضغط زر «وزّع البطاقات» (يُسحب الرهان)', 'اختر إحدى البطاقات الخمس', 'تُكشف البطاقات: ملكية ربح / 2♣ خسارة', 'الجوائز: A♠ ×1.4 / K♥ ×1.6 / Q♦ ×1.75'],
      fr: ['Appuyez sur « Distribuer » (la mise est débitée)', 'Choisissez l\'une des cinq cartes', 'Les cartes sont révélées : royales gagnent / 2♣ perd', 'Prix : A♠ ×1,4 / K♥ ×1,6 / Q♦ ×1,75'],
      en: ['Press Deal cards (bet is taken)', 'Pick one of the five cards', 'Cards are revealed: royal win / 2♣ loses', 'Prizes: A♠ ×1.4 / K♥ ×1.6 / Q♦ ×1.75']
    },
    payouts: {
      ar: '<tr><td>آس البستوني A♠</td><td>×1.4</td></tr><tr><td>ملك القلوب K♥</td><td>×1.6</td></tr><tr><td>ملكة الديناري Q♦</td><td>×1.75</td></tr><tr><td>بطاقة منخفضة 2♣</td><td>×0</td></tr>',
      fr: '<tr><td>As de pique A♠</td><td>×1,4</td></tr><tr><td>Roi de cœur K♥</td><td>×1,6</td></tr><tr><td>Dame de carreau Q♦</td><td>×1,75</td></tr><tr><td>Carte basse 2♣</td><td>×0</td></tr>',
      en: '<tr><td>Ace of spades A♠</td><td>×1.4</td></tr><tr><td>King of hearts K♥</td><td>×1.6</td></tr><tr><td>Queen of diamonds Q♦</td><td>×1.75</td></tr><tr><td>Low card 2♣</td><td>×0</td></tr>'
    },
    tips: {
      ar: ['3 بطاقات رابحة من أصل 5 — احتمال الفوز 60%', 'مجموع المضاعفات 4.75 عبر 5 بطاقات', 'RTP 95% — ميزة الكازينو 5%'],
      fr: ['3 cartes gagnantes sur 5 — probabilité de gain 60 %', 'Total des multiplicateurs 4,75 sur 5 cartes', 'RTP 95 % — avantage du casino 5 %'],
      en: ['3 winning cards out of 5 — win chance 60%', 'Multiplier total 4.75 across 5 cards', 'RTP 95% — house edge 5%']
    }
  },
  /* ═══ Rose ═══ */
  rose: {
    name: { ar: 'وردة الحظ', fr: 'Rose de chance', en: 'Lucky Rose' },
    goal: {
      ar: 'اضغط ابدأ ثم اختر وردة واحدة من 6. أربع وردات ذهبية 🌹 تربح بمضاعفها وصبارتان 🌵 تُخسران الرهان.',
      fr: 'Appuyez sur Démarrer puis choisissez une rose parmi 6. Quatre roses dorées 🌹 gagnent leur multiplicateur, deux cactus 🌵 font perdre la mise.',
      en: 'Press Start then pick one rose out of 6. Four golden roses 🌹 pay their multiplier, two cactus 🌵 lose the bet.'
    },
    steps: {
      ar: ['اضغط زر «ازرع الورد» (يُسحب الرهان)', 'اختر أي وردة من الصف', 'تُكشف الورود: ذهبية 🌹 ربح / صبار 🌵 خسارة', 'المضاعفات: ×1.2 حتى ×1.7'],
      fr: ['Appuyez sur « Planter la rose » (la mise est débitée)', 'Choisissez n\'importe quelle rose de la rangée', 'Les roses sont révélées : dorées 🌹 gagnent / cactus 🌵 perd', 'Multiplicateurs : ×1,2 à ×1,7'],
      en: ['Press Plant rose (bet is taken)', 'Pick any rose from the row', 'Roses are revealed: golden 🌹 win / cactus 🌵 loses', 'Multipliers: ×1.2 up to ×1.7']
    },
    payouts: {
      ar: '<tr><td>وردة ذهبية ×1.2 / ×1.3 / ×1.5 / ×1.7</td><td>×1.2-×1.7</td></tr><tr><td>صبار</td><td>×0</td></tr>',
      fr: '<tr><td>Rose dorée ×1,2 / ×1,3 / ×1,5 / ×1,7</td><td>×1,2-×1,7</td></tr><tr><td>Cactus</td><td>×0</td></tr>',
      en: '<tr><td>Golden rose ×1.2 / ×1.3 / ×1.5 / ×1.7</td><td>×1.2-×1.7</td></tr><tr><td>Cactus</td><td>×0</td></tr>'
    },
    tips: {
      ar: ['4 وردات رابحة من أصل 6 — احتمال الفوز 66.7%', 'مجموع المضاعفات 5.7 عبر 6 وردات', 'RTP 95% — ميزة الكازينو 5%'],
      fr: ['4 roses gagnantes sur 6 — probabilité de gain 66,7 %', 'Total des multiplicateurs 5,7 sur 6 roses', 'RTP 95 % — avantage du casino 5 %'],
      en: ['4 winning roses out of 6 — win chance 66.7%', 'Multiplier total 5.7 across 6 roses', 'RTP 95% — house edge 5%']
    }
  },
  /* ═══ Sweet Bonanza ═══ */
  "sweet-bonanza": {
    name: { ar: 'سويت بونانزا', fr: 'Sweet Bonanza', en: 'Sweet Bonanza' },
    goal: {
      ar: 'اضغط ابدأ ثم اختر حلوى واحدة من 12. ثماني حلوى لذيذة 🍬 تربح بمضاعفها وأربع قنابل 💥 تُخسر الرهان.',
      fr: 'Appuyez sur Démarrer puis choisissez un bonbon parmi 12. Huit bonbons sucrés 🍬 gagnent leur multiplicateur, quatre bombes 💥 font perdre la mise.',
      en: 'Press Start then pick one candy out of 12. Eight sweet candies 🍬 pay their multiplier, four bombs 💥 lose the bet.'
    },
    steps: {
      ar: ['اضغط زر «فجّر الحلوى» (يُسحب الرهان)', 'اختر أي حلوى من الشبكة 4×3', 'تُكشف الحلوى: لذيذة 🍬 ربح / قنبلة 💥 خسارة', 'المضاعفات: ×1.2 حتى ×1.8'],
      fr: ['Appuyez sur « Éclater les bonbons » (la mise est débitée)', 'Choisissez n\'importe quel bonbon de la grille 4×3', 'Les bonbons sont révélés : sucrés 🍬 gagnent / bombe 💥 perd', 'Multiplicateurs : ×1,2 à ×1,8'],
      en: ['Press Pop candies (bet is taken)', 'Pick any candy from the 4×3 grid', 'Candies are revealed: sweet 🍬 win / bomb 💥 loses', 'Multipliers: ×1.2 up to ×1.8']
    },
    payouts: {
      ar: '<tr><td>حلوى 🍭 ×1.2</td><td>×1.2</td></tr><tr><td>حلوى 🍬 ×1.3</td><td>×1.3</td></tr><tr><td>شوكولاتة 🍫 ×1.4</td><td>×1.4</td></tr><tr><td>دونات 🍩 ×1.5</td><td>×1.5</td></tr><tr><td>كب كيك 🧁 ×1.8</td><td>×1.8</td></tr><tr><td>قنبلة</td><td>×0</td></tr>',
      fr: '<tr><td>Bonbon 🍭 ×1,2</td><td>×1,2</td></tr><tr><td>Bonbon 🍬 ×1,3</td><td>×1,3</td></tr><tr><td>Chocolat 🍫 ×1,4</td><td>×1,4</td></tr><tr><td>Donut 🍩 ×1,5</td><td>×1,5</td></tr><tr><td>Cupcake 🧁 ×1,8</td><td>×1,8</td></tr><tr><td>Bombe</td><td>×0</td></tr>',
      en: '<tr><td>Lollipop 🍭 ×1.2</td><td>×1.2</td></tr><tr><td>Candy 🍬 ×1.3</td><td>×1.3</td></tr><tr><td>Chocolate 🍫 ×1.4</td><td>×1.4</td></tr><tr><td>Donut 🍩 ×1.5</td><td>×1.5</td></tr><tr><td>Cupcake 🧁 ×1.8</td><td>×1.8</td></tr><tr><td>Bomb</td><td>×0</td></tr>'
    },
    tips: {
      ar: ['8 حلوى رابحة من أصل 12 — احتمال الفوز 66.7%', 'مجموع المضاعفات 11.4 عبر 12 حلوى', 'RTP 95% — ميزة الكازينو 5%'],
      fr: ['8 bonbons gagnants sur 12 — probabilité de gain 66,7 %', 'Total des multiplicateurs 11,4 sur 12 bonbons', 'RTP 95 % — avantage du casino 5 %'],
      en: ['8 winning candies out of 12 — win chance 66.7%', 'Multiplier total 11.4 across 12 candies', 'RTP 95% — house edge 5%']
    }
  }
};
/* ═══════════════════════════════════════════
   Tutorial System
   ═══════════════════════════════════════════ */
var Tutorial = {
  /* عرض القواعد الكاملة */
  showFullRules: function(gameId) {
    var rules = FULL_RULES[gameId];
    if (!rules) return;
    var lang = (ST.lang === 'fr' || ST.lang === 'en' || ST.lang === 'da') ? ST.lang : 'ar';
    var fallbackLang = (lang === 'da') ? 'ar' : (lang === 'fr' ? 'fr' : (lang === 'en' ? 'en' : 'ar'));
    
    var modal = document.getElementById('rulesModal');
    var title = document.getElementById('rulesTitle');
    var body = document.getElementById('rulesBody');
    
    var gName = rules.name[lang] || rules.name[fallbackLang] || rules.name['ar'] || rules.name['en'] || 'اللعبة';
    if (title) title.textContent = '📖 ' + gName;
    
    var html = '<div class="rules-full">';
    
    /* الهدف */
    var goalText = rules.goal[lang] || rules.goal[fallbackLang] || rules.goal['ar'] || rules.goal['en'] || '';
    html += '<div class="rules-section">';
    html += '<h4><i class="fa-solid fa-bullseye" aria-hidden="true"></i> ' + (T('ui.goal') || 'الهدف') + '</h4>';
    html += '<p>' + goalText + '</p>';
    html += '</div>';
    
    /* الخطوات */
    var stepsList = rules.steps[lang] || rules.steps[fallbackLang] || rules.steps['ar'] || rules.steps['en'] || [];
    if (stepsList.length > 0) {
      html += '<div class="rules-section">';
      html += '<h4><i class="fa-solid fa-list-ol" aria-hidden="true"></i> ' + (T('ui.steps') || 'طريقة اللعب') + '</h4>';
      html += '<ol class="rules-steps">';
      stepsList.forEach(function(step) {
        html += '<li>' + step + '</li>';
      });
      html += '</ol>';
      html += '</div>';
    }
    
    /* القواعد الرسمية التفصيلية */
    var detailsList = rules.details ? (rules.details[lang] || rules.details[fallbackLang] || rules.details['ar'] || rules.details['en']) : null;
    if (detailsList && detailsList.length > 0) {
      html += '<div class="rules-section">';
      html += '<h4><i class="fa-solid fa-gavel" aria-hidden="true"></i> ' + (T('ui.officialRules') || 'القواعد الرسمية') + '</h4>';
      detailsList.forEach(function(sec) {
        html += '<h5 class="rules-sub">' + sec.h + '</h5>';
        html += '<ul class="rules-details">';
        sec.items.forEach(function(it) {
          html += '<li>' + it + '</li>';
        });
        html += '</ul>';
      });
      html += '</div>';
    }
    
    /* جدول الدفع */
    var payoutContent = rules.payouts[lang] || rules.payouts[fallbackLang] || rules.payouts['ar'] || rules.payouts['en'];
    if (payoutContent) {
      html += '<div class="rules-section">';
      html += '<h4><i class="fa-solid fa-table-list" aria-hidden="true"></i> ' + (T('ui.payouts') || 'جدول الأرباح والمضاعفات') + '</h4>';
      html += '<table class="atable">';
      html += '<thead><tr><th>' + (T('ui.outcome') || 'النتيجة') + '</th><th>' + (T('ui.reward') || 'المضاعف / المكسب') + '</th></tr></thead>';
      html += '<tbody>' + payoutContent + '</tbody>';
      html += '</table>';
      html += '</div>';
    }
    
    /* نصائح */
    var tipsList = rules.tips[lang] || rules.tips[fallbackLang] || rules.tips['ar'] || rules.tips['en'] || [];
    if (tipsList.length > 0) {
      html += '<div class="rules-section">';
      html += '<h4><i class="fa-solid fa-lightbulb" aria-hidden="true"></i> ' + (T('ui.tips') || 'نصائح وإرشادات') + '</h4>';
      html += '<ul class="rules-tips">';
      tipsList.forEach(function(tip) {
        html += '<li>' + tip + '</li>';
      });
      html += '</ul>';
      html += '</div>';
    }
    
    html += '</div>';
    if (body) body.innerHTML = html;
    if (modal) modal.classList.add('show');
    if (typeof SND !== 'undefined' && SND.click) SND.click();
  },
  /* فحص أول مرة لعب */
  checkFirstPlay: function(gameId) {
    var key = 'rc_played_' + gameId;
    if (!sGet(key, null)) {
      Tutorial.showFullRules(gameId);
      sSet(key, '1');
      return true;
    }
    return false;
  },
  /* Tutorial تفاعلي خطوة بخطوة */
  startInteractive: function(gameId) {
    var steps = {
      rn: [
        { target: '.ronda-nums', text: 'اختر رقماً من هنا', arrow: 'down' },
        { target: '.ronda-syms', text: 'ثم اختر رمزاً', arrow: 'down' },
        { target: '.ronda-btn.primary', text: 'اضغط للبدء!', arrow: 'up' }
      ],
      av: [
        { target: '.bets', text: 'حدد مبلغ الرهان أولاً', arrow: 'down' },
        { target: '#cStart', text: 'اضغط هنا للإقلاع', arrow: 'up' },
        { target: '#cCash', text: 'اسحب قبل التحطم!', arrow: 'up' }
      ],
      bj: [
        { target: '#bDeal', text: 'اضغط توزيع لبدء الجولة', arrow: 'up' },
        { target: '#bHit', text: 'اسحب بطاقة إضافية', arrow: 'up' },
        { target: '#bStand', text: 'أو قف وقارن', arrow: 'up' }
      ]
    };
    if (!steps[gameId]) return;
    var currentStep = 0;
    var overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    overlay.innerHTML = '<div class="tutorial-tooltip"></div>';
    document.body.appendChild(overlay);
    function showStep() {
      if (currentStep >= steps[gameId].length) {
        overlay.remove();
        return;
      }
      var step = steps[gameId][currentStep];
      var target = document.querySelector(step.target);
      var tooltip = overlay.querySelector('.tutorial-tooltip');
      if (target) {
        var rect = target.getBoundingClientRect();
        tooltip.textContent = step.text;
        tooltip.style.top = (step.arrow === 'up' ? rect.top - 50 : rect.bottom + 10) + 'px';
        tooltip.style.left = rect.left + 'px';
        target.classList.add('tutorial-highlight');
      }
      overlay.onclick = function() {
        if (target) target.classList.remove('tutorial-highlight');
        currentStep++;
        showStep();
      };
    }
    showStep();
  }
};
/* إغلاق modal القواعد */
function closeRulesModal() {
  document.getElementById('rulesModal').classList.remove('show');
}
function showFullRules() {
  var currentGame = window._currentGameId;
  if (currentGame) {
    Tutorial.showFullRules(currentGame);
  }
}
/* CSS إضافي للـ Tutorial (أضف إلى 03-components.css أو ملف منفصل) */
var tutorialCSS = document.createElement('style');
tutorialCSS.textContent = `
  .tutorial-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 9998;
    cursor: pointer;
  }
  .tutorial-tooltip {
    position: absolute;
    background: var(--gold);
    color: #0A0E1A;
    padding: 10px 16px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.85rem;
    max-width: 250px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    animation: pgIn 0.3s ease;
  }
  .tutorial-highlight {
    position: relative;
    z-index: 9999;
    box-shadow: 0 0 0 4px var(--gold), 0 0 30px rgba(245, 197, 24, 0.5);
    border-radius: 10px;
  }
  .rules-section {
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--bd);
  }
  .rules-section:last-child {
    border-bottom: none;
  }
  .rules-section h4 {
    color: var(--gold);
    font-size: 0.95rem;
    margin-bottom: 10px;
  }
  .rules-section p {
    color: var(--t2);
    font-size: 0.85rem;
    line-height: 1.7;
  }
  .rules-steps {
    padding-inline-start: 20px;
    color: var(--t2);
    font-size: 0.85rem;
  }
  .rules-steps li {
    margin-bottom: 8px;
    line-height: 1.6;
  }
  .rules-tips {
    list-style: none;
    padding: 0;
  }
  .rules-tips li {
    color: var(--t2);
    font-size: 0.82rem;
    padding: 6px 0;
    padding-inline-start: 20px;
    position: relative;
  }
  .rules-tips li::before {
    content: '💡';
    position: absolute;
    inset-inline-start: 0;
  }
`;
document.head.appendChild(tutorialCSS);
