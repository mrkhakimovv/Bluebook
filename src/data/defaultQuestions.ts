import { SATQuestion, SATScoreReport, ModuleId, MODULE_ORDER } from '../types/sat';

const RW_MOD1_BASE: Omit<SATQuestion, 'id' | 'moduleId' | 'number'>[] = [
  {
    type: 'mcq',
    domain: 'Craft and Structure',
    passage: `The following text is adapted from Jhumpa Lahiri's 2003 novel The Namesake, Gogol is an elementary school student in Massachusetts.\n\nIn art class, his favorite hour of the week, he <u>carves</u> his name with paper clips into the bottoms of clay cups and bowls. He pastes uncooked pasta to cardboard, and <u>leaves</u> his signature in fat brush strokes below paintings.`,
    prompt: 'As used in the text, what do the words “carves” and “leaves” both most nearly mean?',
    options: [
      { id: 'A', text: 'Marks' },
      { id: 'B', text: 'Passes' },
      { id: 'C', text: 'Turns' },
      { id: 'D', text: 'Follows' },
    ],
    correctAnswer: 'A',
    explanation: 'In this context, carving his name into clay and leaving his signature below paintings both refer to making a visible mark or inscription.',
  },
  {
    type: 'mcq',
    domain: 'Craft and Structure',
    passage: `Marine biologist Ayana Elizabeth Johnson notes that coral reefs occupy less than one percent of the ocean floor yet support roughly a quarter of all marine species. Because these ecosystems are so biologically _______, their preservation is central to global ocean conservation efforts.`,
    prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
    options: [
      { id: 'A', text: 'redundant' },
      { id: 'B', text: 'concentrated' },
      { id: 'C', text: 'ephemeral' },
      { id: 'D', text: 'detached' },
    ],
    correctAnswer: 'B',
    explanation: 'A quarter of all marine species packed into less than one percent of the ocean floor indicates that life in coral reefs is highly concentrated.',
  },
  {
    type: 'mcq',
    domain: 'Information and Ideas',
    passage: `In a study of urban microclimates, researchers measured surface temperatures across 40 neighborhoods in Phoenix, Arizona. They found that blocks with at least 30% tree canopy cover averaged 4.8°C cooler during late afternoon hours than blocks with less than 5% canopy cover, even when pavement materials were identical.`,
    prompt: 'Which choice best states the main finding of the study?',
    options: [
      { id: 'A', text: 'Pavement material has no measurable impact on afternoon temperatures in Phoenix.' },
      { id: 'B', text: 'Substantial tree canopy cover significantly reduces afternoon surface temperatures regardless of pavement type.' },
      { id: 'C', text: 'Most neighborhoods in Phoenix currently have less than 5% tree canopy coverage.' },
      { id: 'D', text: 'Afternoon temperatures in urban areas are primarily determined by building height.' },
    ],
    correctAnswer: 'B',
    explanation: 'The text directly reports that blocks with ≥30% tree canopy were 4.8°C cooler than low-canopy blocks even with identical pavement.',
  },
  {
    type: 'mcq',
    domain: 'Craft and Structure',
    passage: `While early twentieth-century astronomers generally assumed that spiral nebulae were relatively small clouds of gas within our own Milky Way galaxy, Edwin Hubble's 1924 observations of Cepheid variable stars in the Andromeda Nebula _______ that assumption, proving Andromeda lay millions of light-years beyond the Milky Way.`,
    prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
    options: [
      { id: 'A', text: 'corroborated' },
      { id: 'B', text: 'overturned' },
      { id: 'C', text: 'imitated' },
      { id: 'D', text: 'postponed' },
    ],
    correctAnswer: 'B',
    explanation: 'Hubble proved that Andromeda lay outside the Milky Way, which directly overturned the earlier assumption.',
  },
  {
    type: 'mcq',
    domain: 'Craft and Structure',
    passage: `The following text is from Edith Wharton's 1920 novel The Age of Innocence.\n\nNewland Archer, during a solitary walk through the gallery, paused before the portrait of an ancestor whose calm, unhurried gaze seemed to rebuke the restless haste of modern society. Archer felt at once comforted and subtly constrained by the continuity of family tradition.`,
    prompt: 'According to the text, how does Newland Archer respond to the portrait?',
    options: [
      { id: 'A', text: 'He experiences mixed feelings of reassurance and restriction regarding his family heritage.' },
      { id: 'B', text: 'He resolves to abandon the gallery and reject his family’s expectations.' },
      { id: 'C', text: 'He critiques the artistic technique used by the painter of the portrait.' },
      { id: 'D', text: 'He feels indifferent toward the traditions of earlier generations.' },
    ],
    correctAnswer: 'A',
    explanation: 'Being "at once comforted and subtly constrained" reflects mixed feelings of reassurance and restriction.',
  },
  {
    type: 'mcq',
    domain: 'Information and Ideas',
    passage: `Archaeologists excavating the ancient settlement of Catalhoyuk in modern-day Turkey discovered obsidian tools whose chemical signature matched volcanic sources more than 190 kilometers away. Because no closer obsidian deposits have been identified, the researchers concluded that _______`,
    prompt: 'Which choice most logically completes the text?',
    options: [
      { id: 'A', text: 'the inhabitants of Catalhoyuk participated in long-distance trade or resource acquisition networks.' },
      { id: 'B', text: 'volcanic activity occurred directly beneath the settlement of Catalhoyuk.' },
      { id: 'C', text: 'obsidian tools were rarely used for agricultural tasks in ancient Turkey.' },
      { id: 'D', text: 'nearby settlements refused to exchange goods with the residents of Catalhoyuk.' },
    ],
    correctAnswer: 'A',
    explanation: 'Obtaining volcanic glass from over 190 km away logically implies long-distance travel or trade networks.',
  },
  {
    type: 'mcq',
    domain: 'Standard English Conventions',
    passage: `Known for her geometric textile patterns that combined vibrant colors with unexpected textures, weaver Anni Albers helped transform fiber art from a traditional craft into a respected medium of modernist _______ her influential 1965 treatise On Weaving remains a foundational text for designers today.`,
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      { id: 'A', text: 'expression' },
      { id: 'B', text: 'expression,' },
      { id: 'C', text: 'expression; and' },
      { id: 'D', text: 'expression;' },
    ],
    correctAnswer: 'D',
    explanation: 'A semicolon is required to join two closely related independent clauses without a coordinating conjunction.',
  },
  {
    type: 'mcq',
    domain: 'Standard English Conventions',
    passage: `When the James Webb Space Telescope deployed its sunshield in January 2022, engineers monitored 178 release mechanisms in real time. Each of the five thin Kapton layers _______ designed to reflect solar heat and keep the telescope’s infrared instruments at cryogenic temperatures.`,
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      { id: 'A', text: 'were' },
      { id: 'B', text: 'was' },
      { id: 'C', text: 'have been' },
      { id: 'D', text: 'are being' },
    ],
    correctAnswer: 'B',
    explanation: 'The singular subject "Each" requires the singular past-tense verb "was".',
  },
  {
    type: 'mcq',
    domain: 'Expression of Ideas',
    passage: `Traditional desalination plants rely on reverse osmosis membranes that require high pressure and substantial electrical energy. _______ researchers at MIT have developed a portable solar-powered desalination unit that uses ion concentration polarization, removing salt particles without high-pressure filters.`,
    prompt: 'Which choice completes the text with the most logical transition?',
    options: [
      { id: 'A', text: 'By contrast,' },
      { id: 'B', text: 'Consequently,' },
      { id: 'C', text: 'Similarly,' },
      { id: 'D', text: 'For instance,' },
    ],
    correctAnswer: 'A',
    explanation: '"By contrast," properly signals the difference between high-pressure membrane desalination and the new filterless solar approach.',
  },
  {
    type: 'mcq',
    domain: 'Craft and Structure',
    passage: `Economist Elinor Ostrom challenged the prevailing belief that shared natural resources—such as fisheries, pastures, and groundwater basins—are inevitably depleted unless privatized or regulated by central governments. Through fieldwork across dozens of countries, Ostrom demonstrated that local communities frequently devise durable, self-enforcing rules to manage shared resources sustainably.`,
    prompt: 'Which choice best describes the overall structure of the text?',
    options: [
      { id: 'A', text: 'It summarizes a conventional theory and then presents empirical work that refutes that theory.' },
      { id: 'B', text: 'It questions the methodology of an influential economist and proposes an alternative study.' },
      { id: 'C', text: 'It compares two competing governmental policies for regulating marine fisheries.' },
      { id: 'D', text: 'It outlines the historical causes of groundwater depletion in agricultural regions.' },
    ],
    correctAnswer: 'A',
    explanation: 'The first sentence introduces the conventional theory about shared resources, and the second presents Ostrom’s fieldwork that refutes it.',
  },
  {
    type: 'mcq',
    domain: 'Information and Ideas',
    passage: `Mycorrhizal fungi form symbiotic associations with the roots of over 90% of terrestrial plant species. While the plant supplies the fungus with carbon fixed during photosynthesis, the fungal mycelium extends far into the surrounding soil, absorbing phosphorus and nitrogen and transferring them to the host plant.`,
    prompt: 'According to the text, what benefit does the plant receive from its association with mycorrhizal fungi?',
    options: [
      { id: 'A', text: 'An increased ability to perform photosynthesis in low-light environments' },
      { id: 'B', text: 'Access to essential soil nutrients such as phosphorus and nitrogen' },
      { id: 'C', text: 'Protection from aboveground herbivorous insects' },
      { id: 'D', text: 'A reduction in the amount of carbon required for root growth' },
    ],
    correctAnswer: 'B',
    explanation: 'The passage states that the fungal mycelium absorbs phosphorus and nitrogen from the soil and transfers them to the host plant.',
  },
  {
    type: 'mcq',
    domain: 'Standard English Conventions',
    passage: `In the 1940s, biochemist Gerty Cori and her colleagues elucidated the catalytic conversion of glycogen, a discovery that explained how the human body stores and utilizes glucose. In 1947, Cori’s groundbreaking research earned _______ the Nobel Prize in Physiology or Medicine.`,
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      { id: 'A', text: 'her' },
      { id: 'B', text: 'them' },
      { id: 'C', text: 'it' },
      { id: 'D', text: 'herself' },
    ],
    correctAnswer: 'A',
    explanation: 'The pronoun refers to the singular antecedent Gerty Cori ("Cori’s groundbreaking research"), requiring the singular objective pronoun "her".',
  },
  {
    type: 'mcq',
    domain: 'Expression of Ideas',
    passage: `While researching a topic, a student has taken the following notes:\n• The Svalbard Global Seed Vault is located on the Norwegian island of Spitsbergen.\n• It opened in 2008 inside a sandstone mountain 130 meters above sea level.\n• The vault stores duplicate samples of over 1.2 million crop varieties from gene banks worldwide.\n• Permafrost surrounding the facility helps keep the seeds frozen at −18°C even if power fails.`,
    prompt: 'The student wants to explain how the vault’s natural environment contributes to seed preservation. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
    options: [
      { id: 'A', text: 'Opened in 2008 on the Norwegian island of Spitsbergen, the Svalbard Global Seed Vault safeguards over 1.2 million crop varieties.' },
      { id: 'B', text: 'Surrounding permafrost helps maintain the Svalbard Global Seed Vault’s −18°C temperature, keeping seeds frozen even during power outages.' },
      { id: 'C', text: 'Gene banks from around the world send duplicate crop samples to Spitsbergen, Norway.' },
      { id: 'D', text: 'The Svalbard Global Seed Vault is situated 130 meters above sea level and holds over 1.2 million seed samples.' },
    ],
    correctAnswer: 'B',
    explanation: 'Choice B directly explains how the natural environment (surrounding permafrost) helps preserve seeds at −18°C.',
  },
  {
    type: 'mcq',
    domain: 'Craft and Structure',
    passage: `Many historians of science once portrayed the Scientific Revolution as a sudden break from medieval thought. Recent scholarship, however, has emphasized _______: fourteenth-century scholars at Oxford and Paris had already developed mathematical frameworks for analyzing accelerated motion that Galileo later refined.`,
    prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
    options: [
      { id: 'A', text: 'continuity' },
      { id: 'B', text: 'ambiguity' },
      { id: 'C', text: 'neutrality' },
      { id: 'D', text: 'spontaneity' },
    ],
    correctAnswer: 'A',
    explanation: 'Showing that Galileo refined mathematical frameworks developed in the 14th century emphasizes historical continuity rather than a sudden break.',
  },
  {
    type: 'mcq',
    domain: 'Standard English Conventions',
    passage: `Architect Zaha Hadid’s Heydar Aliyev Center in Baku features sweeping, fluid curves that appear to rise organically from the surrounding plaza. Avoiding sharp angles and rigid _______ the building exemplifies Hadid’s pioneering approach to parametric design.`,
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      { id: 'A', text: 'symmetry' },
      { id: 'B', text: 'symmetry;' },
      { id: 'C', text: 'symmetry,' },
      { id: 'D', text: 'symmetry—' },
    ],
    correctAnswer: 'C',
    explanation: 'A comma is needed to set off the introductory participial phrase "Avoiding sharp angles and rigid symmetry," from the main clause.',
  },
  {
    type: 'mcq',
    domain: 'Information and Ideas',
    passage: `Text 1:\nLiterary critic Franco Moretti argues that "distant reading"—using computational tools to analyze word frequencies and genre trends across thousands of novels simultaneously—reveals macro-level patterns in literary history that close reading of a few canonical texts cannot detect.\n\nText 2:\nWhile acknowledging the utility of digital archives, scholar Gayatri Chakravorty Spivak cautions that algorithmic summaries strip away irony, rhetorical ambiguity, and cultural nuance, which can only be understood through attentive engagement with individual sentences.`,
    prompt: 'Based on the texts, how would Spivak (Text 2) most likely respond to Moretti’s approach (Text 1)?',
    options: [
      { id: 'A', text: 'By arguing that computational analysis overlooks subtle stylistic and cultural dimensions that require close reading' },
      { id: 'B', text: 'By suggesting that digital archives should be expanded to include non-European novels' },
      { id: 'C', text: 'By agreeing that close reading of canonical texts is no longer necessary in literary studies' },
      { id: 'D', text: 'By claiming that word-frequency software is too expensive for most university departments' },
    ],
    correctAnswer: 'A',
    explanation: 'Spivak warns that algorithmic summaries miss irony, ambiguity, and nuance that require attentive reading of individual sentences.',
  },
  {
    type: 'mcq',
    domain: 'Expression of Ideas',
    passage: `In northern latitudes, snowshoe hares molt twice a year, replacing their brown summer fur with white winter coats to remain camouflaged against snow. Climate change has shortened the duration of winter snowpack in many regions; _______ hares whose coats turn white before snowfall stand out starkly against bare brown ground.`,
    prompt: 'Which choice completes the text with the most logical transition?',
    options: [
      { id: 'A', text: 'nevertheless,' },
      { id: 'B', text: 'as a result,' },
      { id: 'C', text: 'in other words,' },
      { id: 'D', text: 'meanwhile,' },
    ],
    correctAnswer: 'B',
    explanation: 'Shortened snowpack duration directly causes white hares to stand out against bare ground, making "as a result," the logical transition.',
  },
  {
    type: 'mcq',
    domain: 'Standard English Conventions',
    passage: `The Rosetta Stone, inscribed in 196 BCE with a royal decree issued at Memphis, presents the same text in three scripts: Ancient Egyptian hieroglyphs, Demotic script, and Ancient Greek. Because scholars could already read Ancient _______ philologist Jean-François Champollion was able to decipher the hieroglyphic inscriptions in 1822.`,
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      { id: 'A', text: 'Greek, French' },
      { id: 'B', text: 'Greek; French' },
      { id: 'C', text: 'Greek. French' },
      { id: 'D', text: 'Greek—French' },
    ],
    correctAnswer: 'A',
    explanation: 'A comma is required after the introductory dependent clause "Because scholars could already read Ancient Greek," before the main clause starting with "French philologist".',
  },
  {
    type: 'mcq',
    domain: 'Craft and Structure',
    passage: `When behavioral economists study consumer choices, they often observe the "endowment effect": individuals place a significantly higher monetary value on an object once they own it than they did moments before acquiring it. This tendency _______ the standard economic assumption that a person's valuation of a good is independent of ownership.`,
    prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
    options: [
      { id: 'A', text: 'complicates' },
      { id: 'B', text: 'validates' },
      { id: 'C', text: 'replicates' },
      { id: 'D', text: 'foresaw' },
    ],
    correctAnswer: 'A',
    explanation: 'The endowment effect contradicts or complicates the standard assumption that valuation is independent of ownership.',
  },
  {
    type: 'mcq',
    domain: 'Information and Ideas',
    passage: `Honeybees communicate the location of floral nectar sources through the "waggle dance," in which the angle of the bee’s waggle run relative to vertical on the honeycomb corresponds to the angle of the food source relative to the sun outside the hive. Biologist Karl von Frisch demonstrated that even when the sky is overcast, bees orient their dances accurately by detecting polarized ultraviolet light.`,
    prompt: 'According to the text, how are honeybees able to perform accurate waggle dances on cloudy days?',
    options: [
      { id: 'A', text: 'They rely on landmarks such as tall trees rather than solar angles.' },
      { id: 'B', text: 'They perceive patterns of polarized ultraviolet light through the clouds.' },
      { id: 'C', text: 'They switch from visual cues to chemical scent trails inside the hive.' },
      { id: 'D', text: 'They shorten the duration of the waggle run to account for reduced visibility.' },
    ],
    correctAnswer: 'B',
    explanation: 'The text states that bees orient their dances accurately on overcast days by detecting polarized ultraviolet light.',
  },
  {
    type: 'mcq',
    domain: 'Standard English Conventions',
    passage: `Featuring intricate polyrhythms and call-and-response vocals, Afro-Cuban jazz emerged in New York City during the 1940s through collaborations between trumpeter Dizzy Gillespie and percussionist Chano Pozo. The genre’s rhythmic complexity—rooted in the clave pattern—_______ generations of jazz composers ever since.`,
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      { id: 'A', text: 'have inspired' },
      { id: 'B', text: 'inspire' },
      { id: 'C', text: 'has inspired' },
      { id: 'D', text: 'were inspiring' },
    ],
    correctAnswer: 'C',
    explanation: 'The singular subject "complexity" and the temporal phrase "ever since" require the singular present perfect verb "has inspired".',
  },
  {
    type: 'mcq',
    domain: 'Expression of Ideas',
    passage: `In 1977, NASA launched the Voyager 1 and Voyager 2 spacecraft to study Jupiter, Saturn, Uranus, and Neptune. _______ their primary planetary missions concluded in the late 1980s, both probes have continued transmitting data from interstellar space for nearly five decades.`,
    prompt: 'Which choice completes the text with the most logical transition?',
    options: [
      { id: 'A', text: 'Although' },
      { id: 'B', text: 'Because' },
      { id: 'C', text: 'Unless' },
      { id: 'D', text: 'Therefore,' },
    ],
    correctAnswer: 'A',
    explanation: '"Although" properly introduces the subordinate concessive clause contrasting the conclusion of the primary mission with ongoing operation.',
  },
  {
    type: 'mcq',
    domain: 'Craft and Structure',
    passage: `In her sculptures made from reclaimed fishing nets suspended high above public plazas, artist Janet Echelman creates billowing, translucent forms that ripple in the wind. Observers have noted that the works feel paradoxically _______ despite spanning hundreds of feet and weighing several tons.`,
    prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
    options: [
      { id: 'A', text: 'weightless' },
      { id: 'B', text: 'monotonous' },
      { id: 'C', text: 'opaque' },
      { id: 'D', text: 'rigid' },
    ],
    correctAnswer: 'A',
    explanation: 'The contrast with "weighing several tons" and "paradoxically" points directly to "weightless".',
  },
  {
    type: 'mcq',
    domain: 'Information and Ideas',
    passage: `To test whether elephants can distinguish between human languages associated with varying levels of threat, Karen McComb and colleagues played audio recordings of Maasai men (who occasionally conflict with elephants) and Kamba men (whose agricultural lifestyle poses little threat) to wild family groups in Amboseli National Park. The elephants formed defensive bunches significantly more often when hearing Maasai voices than when hearing Kamba voices.`,
    prompt: 'Which finding, if true, would further support the researchers’ conclusion that elephants use subtle acoustic cues to assess human threat levels?',
    options: [
      { id: 'A', text: 'Elephants exhibited significantly fewer defensive behaviors when hearing recordings of Maasai women and children, who do not hunt elephants, than when hearing Maasai men.' },
      { id: 'B', text: 'Elephants in Amboseli National Park travel longer distances during the dry season than during the rainy season.' },
      { id: 'C', text: 'Both Maasai and Kamba languages belong to linguistic families spoken across East Africa.' },
      { id: 'D', text: 'Younger matriarchs were less likely to locate water sources than older matriarchs were.' },
    ],
    correctAnswer: 'A',
    explanation: 'Distinguishing between male and female/child voices within the same language group based on threat level further supports acoustic threat assessment.',
  },
  {
    type: 'mcq',
    domain: 'Standard English Conventions',
    passage: `During the Harlem Renaissance, Augusta Savage sculpted busts of prominent African American leaders, taught emerging artists at the Savage Studio of Arts and Crafts, and advocated for equal representation in federal art projects. Her bronze portrait of W.E.B. Du Bois, _______ was celebrated for its expressive realism.`,
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      { id: 'A', text: 'for example' },
      { id: 'B', text: 'for example,' },
      { id: 'C', text: 'for example;' },
      { id: 'D', text: 'for example:' },
    ],
    correctAnswer: 'B',
    explanation: 'The parenthetical transition "for example" is preceded by a comma and must be followed by a matching comma.',
  },
  {
    type: 'mcq',
    domain: 'Expression of Ideas',
    passage: `While researching a topic, a student has taken the following notes:\n• Bioluminescence is the production and emission of light by a living organism.\n• Up to 76% of marine organisms in the deep ocean pelagic zone are bioluminescent.\n• The Hawaiian bobtail squid houses bioluminescent Vibrio fischeri bacteria in a specialized light organ.\n• The downward-directed light matches ambient moonlight, hiding the squid’s silhouette from predators swimming below.`,
    prompt: 'The student wants to explain how the Hawaiian bobtail squid uses bioluminescence for defense. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
    options: [
      { id: 'A', text: 'In the deep ocean pelagic zone, up to 76% of marine organisms produce their own light through bioluminescence.' },
      { id: 'B', text: 'By emitting downward light from symbiotic bacteria that matches ambient moonlight, the Hawaiian bobtail squid conceals its silhouette from predators below.' },
      { id: 'C', text: 'The Hawaiian bobtail squid forms a symbiotic relationship with Vibrio fischeri bacteria inside a specialized organ.' },
      { id: 'D', text: 'Bioluminescence, the emission of light by living organisms, is common among marine species such as the Hawaiian bobtail squid.' },
    ],
    correctAnswer: 'B',
    explanation: 'Choice B directly explains the defensive mechanism (concealing its silhouette from predators below by matching moonlight).',
  },
  {
    type: 'mcq',
    domain: 'Craft and Structure',
    passage: `Because ancient papyrus scrolls carbonized during the 79 CE eruption of Mount Vesuvius are too brittle to be physically unrolled without crumbling, computer scientists have turned to non-invasive X-ray phase-contrast tomography. Combined with machine-learning models trained to detect subtle ink textures, this method renders previously _______ texts legible once again.`,
    prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
    options: [
      { id: 'A', text: 'inaccessible' },
      { id: 'B', text: 'unanimous' },
      { id: 'C', text: 'superfluous' },
      { id: 'D', text: 'transparent' },
    ],
    correctAnswer: 'A',
    explanation: 'Scrolls that could not be unrolled without crumbling were previously unreadable or inaccessible.',
  },
];

const RW_MOD2_BASE: Omit<SATQuestion, 'id' | 'moduleId' | 'number'>[] = [
  {
    type: 'mcq',
    domain: 'Craft and Structure',
    passage: `In her analysis of seventeenth-century Dutch still-life paintings, art historian Svetlana Alpers argues that the painters’ meticulous rendering of glass reflections, citrus peels, and imported porcelain was not merely decorative; rather, it reflected an empirical culture that prized visual observation as a primary mode of _______ the material world.`,
    prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
    options: [
      { id: 'A', text: 'comprehending' },
      { id: 'B', text: 'relinquishing' },
      { id: 'C', text: 'fabricating' },
      { id: 'D', text: 'concealing' },
    ],
    correctAnswer: 'A',
    explanation: 'An empirical culture valuing observation uses it as a means of understanding or comprehending the material world.',
  },
  {
    type: 'mcq',
    domain: 'Information and Ideas',
    passage: `Plants emit ultrasonic airborne sounds when subjected to drought stress or physical cutting. In a 2023 study, Lilach Hadany and colleagues recorded tomato and tobacco plants inside acoustic chambers and trained a machine-learning classifier on the recordings. The model distinguished between drought-stressed and cut plants with over 70% accuracy, demonstrating that acoustic emissions carry specific physiological information.`,
    prompt: 'What is the main idea of the text?',
    options: [
      { id: 'A', text: 'Tomato plants produce louder ultrasonic sounds than tobacco plants do under normal greenhouse conditions.' },
      { id: 'B', text: 'Ultrasonic sounds emitted by stressed plants vary systematically depending on the type of stress experienced.' },
      { id: 'C', text: 'Acoustic chambers prevent plants from experiencing severe dehydration.' },
      { id: 'D', text: 'Insects rely exclusively on ultrasonic plant sounds to select host leaves.' },
    ],
    correctAnswer: 'B',
    explanation: 'Because a classifier could distinguish drought-stressed from cut plants, the ultrasonic sounds carry stress-specific information.',
  },
  {
    type: 'mcq',
    domain: 'Standard English Conventions',
    passage: `Built between 1931 and 1936 in the Black Canyon of the Colorado River, Hoover Dam impounds Lake Mead, the largest reservoir in the United States by volume. The dam’s seventeen hydroelectric _______ generate roughly four billion kilowatt-hours of electricity each year.`,
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      { id: 'A', text: 'turbines—' },
      { id: 'B', text: 'turbines,' },
      { id: 'C', text: 'turbines' },
      { id: 'D', text: 'turbines;' },
    ],
    correctAnswer: 'C',
    explanation: 'No punctuation should separate the subject "turbines" from its verb "generate".',
  },
  {
    type: 'mcq',
    domain: 'Expression of Ideas',
    passage: `Quantum computers use qubits that can exist in superpositions of 0 and 1 simultaneously, enabling exponential speedups for certain factoring and simulation problems. _______ qubits are extremely sensitive to thermal noise and electromagnetic interference, requiring complex error-correction protocols.`,
    prompt: 'Which choice completes the text with the most logical transition?',
    options: [
      { id: 'A', text: 'However,' },
      { id: 'B', text: 'Accordingly,' },
      { id: 'C', text: 'For example,' },
      { id: 'D', text: 'In addition,' },
    ],
    correctAnswer: 'A',
    explanation: '"However," contrasts the theoretical power of qubits with their practical fragility.',
  },
  {
    type: 'mcq',
    domain: 'Craft and Structure',
    passage: `The following text is from Kazuo Ishiguro’s 1989 novel The Remains of the Day.\n\nIt is sometimes said that butlers only truly exist in England. Other countries, whatever title is actually used, have only manservants. I tend to believe this is true. Continentals are unable to be butlers because they are as a breed incapable of the emotional restraint which only the English race can bring to bear.`,
    prompt: 'Which choice best describes the narrator’s perspective in the text?',
    options: [
      { id: 'A', text: 'He regards extreme emotional restraint as the defining virtue of an authentic butler.' },
      { id: 'B', text: 'He wishes to travel across continental Europe to study hospitality customs.' },
      { id: 'C', text: 'He believes the profession of butler is rapidly disappearing in England.' },
      { id: 'D', text: 'He criticizes English employers for demanding excessive formality.' },
    ],
    correctAnswer: 'A',
    explanation: 'The narrator claims that emotional restraint is the essential quality that distinguishes true butlers.',
  },
  {
    type: 'mcq',
    domain: 'Information and Ideas',
    passage: `Geologists studying zircon crystals from the Jack Hills of Western Australia dated several microscopic grains to 4.37 billion years ago—less than 200 million years after Earth’s formation. Oxygen-isotope ratios within these zircons indicate that the crystals formed in magma that had interacted with liquid water at Earth’s surface, implying that _______`,
    prompt: 'Which choice most logically completes the text?',
    options: [
      { id: 'A', text: 'Earth’s early crust cooled sufficiently to support liquid surface water much earlier than once thought.' },
      { id: 'B', text: 'zircon crystals can only form in the absence of atmospheric oxygen.' },
      { id: 'C', text: 'Western Australia experienced no volcanic activity after 4.37 billion years ago.' },
      { id: 'D', text: 'liquid water was brought to Earth exclusively by impacts during the Late Heavy Bombardment.' },
    ],
    correctAnswer: 'A',
    explanation: 'Zircons formed 4.37 billion years ago in contact with liquid water imply that liquid water existed on Earth’s surface very early.',
  },
  {
    type: 'mcq',
    domain: 'Standard English Conventions',
    passage: `While investigating the migration routes of Arctic terns, ornithologists attached miniature geolocators weighing less than two grams to the birds’ legs. Data recovered the following year revealed that the terns flew an average of 70,900 kilometers annually—a distance _______ any other known animal migration.`,
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      { id: 'A', text: 'surpasses' },
      { id: 'B', text: 'surpassing' },
      { id: 'C', text: 'surpassed' },
      { id: 'D', text: 'had surpassed' },
    ],
    correctAnswer: 'B',
    explanation: 'The present participle "surpassing" properly forms a modifier modifying the appositive noun phrase "a distance".',
  },
  {
    type: 'mcq',
    domain: 'Craft and Structure',
    passage: `Although many contemporary architects prioritize sleek glass facades that maximize daylight, such designs often incur high cooling costs in arid climates. Vernacular desert architecture, by contrast, employs thick adobe walls and narrow recessed windows to _______ solar heat gain during the day.`,
    prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
    options: [
      { id: 'A', text: 'mitigate' },
      { id: 'B', text: 'amplify' },
      { id: 'C', text: 'accelerate' },
      { id: 'D', text: 'reciprocate' },
    ],
    correctAnswer: 'A',
    explanation: 'Thick adobe walls and narrow windows reduce or mitigate solar heat gain.',
  },
  {
    type: 'mcq',
    domain: 'Expression of Ideas',
    passage: `In the 19th century, mathematician Ada Lovelace wrote extensive notes on Charles Babbage’s proposed Analytical Engine. She recognized that the machine could manipulate symbols according to rules rather than merely calculate numbers; _______ she published the first algorithm intended to be carried out by such a machine, earning recognition as the world’s first computer programmer.`,
    prompt: 'Which choice completes the text with the most logical transition?',
    options: [
      { id: 'A', text: 'furthermore,' },
      { id: 'B', text: 'on the other hand,' },
      { id: 'C', text: 'regardless,' },
      { id: 'D', text: 'conversely,' },
    ],
    correctAnswer: 'A',
    explanation: '"Furthermore," adds an additional milestone achievement that builds on her theoretical insight.',
  },
  {
    type: 'mcq',
    domain: 'Standard English Conventions',
    passage: `At the heart of cellular respiration is adenosine triphosphate (ATP), a molecule that captures chemical energy released from the breakdown of food molecules and _______ it to fuel other cellular processes.`,
    prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    options: [
      { id: 'A', text: 'transferring' },
      { id: 'B', text: 'transfers' },
      { id: 'C', text: 'transferred' },
      { id: 'D', text: 'to transfer' },
    ],
    correctAnswer: 'B',
    explanation: 'Parallel structure with "captures" requires the singular present-tense verb "transfers".',
  },
];

// Expand R&W Module 2 to 27 questions cleanly
while (RW_MOD2_BASE.length < 27) {
  const idx = RW_MOD2_BASE.length;
  const template = RW_MOD1_BASE[idx % RW_MOD1_BASE.length];
  RW_MOD2_BASE.push({
    ...template,
    prompt: template.prompt,
  });
}

const MATH_MOD1_BASE: Omit<SATQuestion, 'id' | 'moduleId' | 'number'>[] = [
  // Question 1: Exact match from image_c4c0b9d4.png
  {
    type: 'mcq',
    domain: 'Algebra',
    prompt: 'If $6x + 36 = 54$, what is the value of $x + 6$?',
    options: [
      { id: 'A', text: '$6$' },
      { id: 'B', text: '$9$' },
      { id: 'C', text: '$36$' },
      { id: 'D', text: '$42$' },
    ],
    correctAnswer: 'B',
    explanation: 'Factoring 6 from the left side gives $6(x + 6) = 54$. Dividing both sides by 6 yields $x + 6 = 9$.',
  },
  // Question 2: Exact match from image_438cd193.png
  {
    type: 'mcq',
    domain: 'Algebra',
    prompt: 'For a certain classification, the positive mass $m$, in grams, of an object must be less than 510 grams. Which inequality represents this situation?',
    options: [
      { id: 'A', text: '$m > 510$' },
      { id: 'B', text: '$m < 0$' },
      { id: 'C', text: '$-510 < m < 0$' },
      { id: 'D', text: '$0 < m < 510$' },
    ],
    correctAnswer: 'D',
    explanation: 'Since the mass $m$ is positive ($m > 0$) and must be less than 510 grams ($m < 510$), the compound inequality $0 < m < 510$ represents this situation.',
  },
  // Question 3
  {
    type: 'mcq',
    domain: 'Problem-Solving and Data Analysis',
    prompt: 'Out of 400 randomly selected solar panels produced at a factory, 6 were found to have minor surface defects. At this rate, how many panels out of a batch of 10,000 would be expected to have minor surface defects?',
    options: [
      { id: 'A', text: '$60$' },
      { id: 'B', text: '$120$' },
      { id: 'C', text: '$150$' },
      { id: 'D', text: '$240$' },
    ],
    correctAnswer: 'C',
    explanation: '$(6 / 400) \\times 10,000 = 6 \\times 25 = 150$.',
  },
  // Question 4
  {
    type: 'mcq',
    domain: 'Advanced Math',
    prompt: 'Which expression is equivalent to $(2x^2 + 5x - 3) + (4x^2 - 2x + 7)$?',
    options: [
      { id: 'A', text: '$6x^2 + 3x + 4$' },
      { id: 'B', text: '$6x^2 + 7x + 4$' },
      { id: 'C', text: '$8x^2 + 3x - 10$' },
      { id: 'D', text: '$6x^4 + 3x^2 + 4$' },
    ],
    correctAnswer: 'A',
    explanation: 'Combine like terms: $(2x^2 + 4x^2) + (5x - 2x) + (-3 + 7) = 6x^2 + 3x + 4$.',
  },
  // Question 5
  {
    type: 'mcq',
    domain: 'Geometry and Trigonometry',
    prompt: 'A circle has a radius of 8 centimeters. What is the area, in square centimeters, of the circle?',
    options: [
      { id: 'A', text: '$16\\pi$' },
      { id: 'B', text: '$32\\pi$' },
      { id: 'C', text: '$64\\pi$' },
      { id: 'D', text: '$128\\pi$' },
    ],
    correctAnswer: 'C',
    explanation: 'The area of a circle is $A = \\pi r^2 = \\pi(8)^2 = 64\\pi$.',
  },
  // Question 6
  {
    type: 'mcq',
    domain: 'Algebra',
    prompt: 'For the linear function $g$, $g(2) = 11$ and $g(5) = 23$. What is the value of $g(0)$?',
    options: [
      { id: 'A', text: '$3$' },
      { id: 'B', text: '$4$' },
      { id: 'C', text: '$5$' },
      { id: 'D', text: '$7$' },
    ],
    correctAnswer: 'A',
    explanation: 'The slope is $(23 - 11)/(5 - 2) = 12/3 = 4$. Since $g(2) = 4(2) + b = 11$, $b = 3$, so $g(0) = 3$.',
  },
  // Question 7: Exact match from image_f419f845.png (Student-produced response!)
  {
    type: 'spr',
    domain: 'Algebra',
    prompt: 'The function $f(x) = 180(x - 2)$ gives the sum of the interior angles, in degrees, for a polygon with $x$ sides. What is the sum of the interior angles, in degrees, for a polygon with 35 sides?',
    correctAnswer: '5940',
    explanation: 'Substitute $x = 35$ into $f(x)$: $f(35) = 180(35 - 2) = 180 \\times 33 = 5940$.',
  },
  // Question 8
  {
    type: 'mcq',
    domain: 'Advanced Math',
    prompt: 'If $(x - 4)(x + 7) = 0$, what is the sum of the solutions to the equation?',
    options: [
      { id: 'A', text: '$-11$' },
      { id: 'B', text: '$-3$' },
      { id: 'C', text: '$3$' },
      { id: 'D', text: '$11$' },
    ],
    correctAnswer: 'B',
    explanation: 'The solutions are $x = 4$ and $x = -7$. Their sum is $4 + (-7) = -3$.',
  },
  // Question 9: Exact match from image_2e1e9e8b.png
  {
    type: 'mcq',
    domain: 'Algebra',
    mathEquation: ['$x + 4y = 19$', '$2x + y = 4$'],
    prompt: 'The solution to the given system of equations is $(x, y)$. What is the value of $3x + 5y$?',
    options: [
      { id: 'A', text: '$12$' },
      { id: 'B', text: '$15$' },
      { id: 'C', text: '$23$' },
      { id: 'D', text: '$38$' },
    ],
    correctAnswer: 'C',
    explanation: 'Adding the two equations directly gives $(x + 2x) + (4y + y) = 19 + 4$, so $3x + 5y = 23$.',
  },
  // Question 10
  {
    type: 'mcq',
    domain: 'Problem-Solving and Data Analysis',
    prompt: 'The price of a laptop was reduced by $20\\%$ to $\\$680$. What was the original price of the laptop before the reduction?',
    options: [
      { id: 'A', text: '$\\$800$' },
      { id: 'B', text: '$\\$816$' },
      { id: 'C', text: '$\\$850$' },
      { id: 'D', text: '$\\$900$' },
    ],
    correctAnswer: 'C',
    explanation: '$0.80 \\times P = 680 \\implies P = 680 / 0.80 = 850$.',
  },
  // Question 11
  {
    type: 'spr',
    domain: 'Algebra',
    prompt: 'If $4x - 9 = 27$, what is the value of $x$?',
    correctAnswer: '9',
    explanation: '$4x = 36$, so $x = 9$.',
  },
  // Question 12
  {
    type: 'mcq',
    domain: 'Advanced Math',
    prompt: 'A bacterial culture starts with 500 bacteria and doubles every 3 hours. Which function $P(t)$ gives the number of bacteria $t$ hours after the start?',
    options: [
      { id: 'A', text: '$P(t) = 500(2)^{t/3}$' },
      { id: 'B', text: '$P(t) = 500(2)^{3t}$' },
      { id: 'C', text: '$P(t) = 500(3)^{t/2}$' },
      { id: 'D', text: '$P(t) = 1000^{t/3}$' },
    ],
    correctAnswer: 'A',
    explanation: 'Doubling every 3 hours means the growth factor 2 is applied $t/3$ times after $t$ hours: $P(t) = 500(2)^{t/3}$.',
  },
  // Question 13
  {
    type: 'mcq',
    domain: 'Geometry and Trigonometry',
    prompt: 'In right triangle $ABC$, angle $C$ is a right angle and $\\sin(A) = \\frac{5}{13}$. What is the value of $\\cos(B)$?',
    options: [
      { id: 'A', text: '$\\frac{5}{13}$' },
      { id: 'B', text: '$\\frac{12}{13}$' },
      { id: 'C', text: '$\\frac{5}{12}$' },
      { id: 'D', text: '$\\frac{13}{5}$' },
    ],
    correctAnswer: 'A',
    explanation: 'Since $A$ and $B$ are complementary angles in a right triangle ($A + B = 90^\\circ$), $\\cos(B) = \\sin(A) = 5/13$.',
  },
  // Question 14
  {
    type: 'spr',
    domain: 'Advanced Math',
    prompt: 'For the quadratic function $f(x) = (x - 6)^2 + 14$, what is the minimum value of $f(x)$?',
    correctAnswer: '14',
    explanation: 'In vertex form $f(x) = a(x - h)^2 + k$ with $a = 1 > 0$, the minimum value is $k = 14$.',
  },
  // Question 15
  {
    type: 'mcq',
    domain: 'Problem-Solving and Data Analysis',
    prompt: 'A data set consists of the 7 numbers: $12, 15, 18, 20, 22, 25$, and $x$. If the median of the data set is 20 and $x > 25$, which of the following could be the value of $x$?',
    options: [
      { id: 'A', text: '$14$' },
      { id: 'B', text: '$19$' },
      { id: 'C', text: '$20$' },
      { id: 'D', text: '$34$' },
    ],
    correctAnswer: 'D',
    explanation: 'Since $x > 25$, $34$ is the only choice greater than 25, keeping 20 as the 4th (middle) value.',
  },
  // Question 16
  {
    type: 'mcq',
    domain: 'Algebra',
    prompt: 'In the system of equations $kx + 3y = 12$ and $4x + 6y = 24$, $k$ is a constant. If the system has infinitely many solutions, what is the value of $k$?',
    options: [
      { id: 'A', text: '$2$' },
      { id: 'B', text: '$4$' },
      { id: 'C', text: '$6$' },
      { id: 'D', text: '$8$' },
    ],
    correctAnswer: 'A',
    explanation: 'Multiplying the first equation by 2 gives $2kx + 6y = 24$. Matching coefficients with $4x + 6y = 24$ gives $2k = 4$, so $k = 2$.',
  },
  // Question 17
  {
    type: 'mcq',
    domain: 'Geometry and Trigonometry',
    prompt: 'A right circular cylinder has a radius of 4 meters and a height of 10 meters. What is the volume, in cubic meters, of the cylinder?',
    options: [
      { id: 'A', text: '$40\\pi$' },
      { id: 'B', text: '$80\\pi$' },
      { id: 'C', text: '$160\\pi$' },
      { id: 'D', text: '$400\\pi$' },
    ],
    correctAnswer: 'C',
    explanation: '$V = \\pi r^2 h = \\pi(4^2)(10) = 160\\pi$.',
  },
  // Question 18
  {
    type: 'spr',
    domain: 'Advanced Math',
    prompt: 'If $\\sqrt{3x + 7} = 5$, what is the value of $x$?',
    correctAnswer: '6',
    explanation: 'Squaring both sides gives $3x + 7 = 25 \\implies 3x = 18 \\implies x = 6$.',
  },
  // Question 19
  {
    type: 'mcq',
    domain: 'Advanced Math',
    prompt: 'How many distinct real solutions does the equation $x^2 - 6x + 13 = 0$ have?',
    options: [
      { id: 'A', text: 'Zero' },
      { id: 'B', text: 'Exactly one' },
      { id: 'C', text: 'Exactly two' },
      { id: 'D', text: 'Infinitely many' },
    ],
    correctAnswer: 'A',
    explanation: 'The discriminant is $b^2 - 4ac = (-6)^2 - 4(1)(13) = 36 - 52 = -16 < 0$, so there are zero real solutions.',
  },
  // Question 20
  {
    type: 'mcq',
    domain: 'Geometry and Trigonometry',
    prompt: 'In the $xy$-plane, the graph of $(x - 3)^2 + (y + 5)^2 = 49$ is a circle. What is the diameter of the circle?',
    options: [
      { id: 'A', text: '$7$' },
      { id: 'B', text: '$14$' },
      { id: 'C', text: '$49$' },
      { id: 'D', text: '$98$' },
    ],
    correctAnswer: 'B',
    explanation: '$r^2 = 49$ so the radius is $r = 7$, and the diameter is $2r = 14$.',
  },
  // Question 21
  {
    type: 'spr',
    domain: 'Problem-Solving and Data Analysis',
    prompt: 'The mean of 5 numbers is 18. Four of the numbers are $14, 16, 19$, and $23$. What is the fifth number?',
    correctAnswer: '18',
    explanation: 'The sum of all 5 numbers is $5 \\times 18 = 90$. $90 - (14 + 16 + 19 + 23) = 90 - 72 = 18$.',
  },
  // Question 22
  {
    type: 'mcq',
    domain: 'Advanced Math',
    prompt: 'The function $h$ is defined by $h(x) = 2x^3 - 5x + 1$. What is the value of $h(3)$?',
    options: [
      { id: 'A', text: '$38$' },
      { id: 'B', text: '$40$' },
      { id: 'C', text: '$42$' },
      { id: 'D', text: '$54$' },
    ],
    correctAnswer: 'B',
    explanation: '$h(3) = 2(27) - 5(3) + 1 = 54 - 15 + 1 = 40$.',
  },
];

const MATH_MOD2_BASE: Omit<SATQuestion, 'id' | 'moduleId' | 'number'>[] = [
  {
    type: 'mcq',
    domain: 'Algebra',
    prompt: 'If $8x - 16 = 48$, what is the value of $x - 2$?',
    options: [
      { id: 'A', text: '$4$' },
      { id: 'B', text: '$6$' },
      { id: 'C', text: '$8$' },
      { id: 'D', text: '$10$' },
    ],
    correctAnswer: 'B',
    explanation: 'Factoring 8 from the left side gives $8(x - 2) = 48$. Dividing by 8 gives $x - 2 = 6$.',
  },
  {
    type: 'mcq',
    domain: 'Advanced Math',
    prompt: 'If $x^2 - y^2 = 72$ and $x + y = 9$, what is the value of $x - y$?',
    options: [
      { id: 'A', text: '$6$' },
      { id: 'B', text: '$8$' },
      { id: 'C', text: '$9$' },
      { id: 'D', text: '$12$' },
    ],
    correctAnswer: 'B',
    explanation: '$(x - y)(x + y) = 72 \\implies (x - y)(9) = 72 \\implies x - y = 8$.',
  },
  {
    type: 'spr',
    domain: 'Algebra',
    prompt: 'Line $L$ has a slope of 4 and passes through the point $(2, 13)$. What is the $y$-intercept of line $L$?',
    correctAnswer: '5',
    explanation: '$13 = 4(2) + b \\implies b = 5$.',
  },
  {
    type: 'mcq',
    domain: 'Geometry and Trigonometry',
    prompt: 'A cone has a circular base with radius 6 cm and a height of 8 cm. What is the volume, in cubic centimeters, of the cone?',
    options: [
      { id: 'A', text: '$48\\pi$' },
      { id: 'B', text: '$96\\pi$' },
      { id: 'C', text: '$144\\pi$' },
      { id: 'D', text: '$288\\pi$' },
    ],
    correctAnswer: 'B',
    explanation: '$V = \\frac{1}{3}\\pi r^2 h = \\frac{1}{3}\\pi(36)(8) = 96\\pi$.',
  },
  {
    type: 'mcq',
    domain: 'Problem-Solving and Data Analysis',
    prompt: 'An investment of $\\$2,000$ increases by $5\\%$ each year. Which expression gives the value of the investment, in dollars, after 10 years?',
    options: [
      { id: 'A', text: '$2,000(1.05)^{10}$' },
      { id: 'B', text: '$2,000(0.05)^{10}$' },
      { id: 'C', text: '$2,000 + 1.05(10)$' },
      { id: 'D', text: '$2,000(1.5)^{10}$' },
    ],
    correctAnswer: 'A',
    explanation: 'Compound annual growth of $5\\%$ multiplies the value by $1.05$ each year: $2,000(1.05)^{10}$.',
  },
  {
    type: 'spr',
    domain: 'Advanced Math',
    prompt: 'The equation $x^2 - 14x + c = 0$ has exactly one real solution. What is the value of the constant $c$?',
    correctAnswer: '49',
    explanation: 'For one real solution, the discriminant $b^2 - 4ac = (-14)^2 - 4(1)(c) = 0 \\implies 196 = 4c \\implies c = 49$.',
  },
];

while (MATH_MOD2_BASE.length < 22) {
  const idx = MATH_MOD2_BASE.length;
  const template = MATH_MOD1_BASE[idx % MATH_MOD1_BASE.length];
  MATH_MOD2_BASE.push({ ...template });
}

export function generateDefaultQuestions(): SATQuestion[] {
  const questions: SATQuestion[] = [];

  RW_MOD1_BASE.forEach((q, idx) => {
    questions.push({
      ...q,
      id: `rw_1_q${idx + 1}`,
      moduleId: 'rw_1',
      number: idx + 1,
    });
  });

  RW_MOD2_BASE.forEach((q, idx) => {
    questions.push({
      ...q,
      id: `rw_2_q${idx + 1}`,
      moduleId: 'rw_2',
      number: idx + 1,
    });
  });

  MATH_MOD1_BASE.forEach((q, idx) => {
    questions.push({
      ...q,
      id: `math_1_q${idx + 1}`,
      moduleId: 'math_1',
      number: idx + 1,
    });
  });

  MATH_MOD2_BASE.forEach((q, idx) => {
    questions.push({
      ...q,
      id: `math_2_q${idx + 1}`,
      moduleId: 'math_2',
      number: idx + 1,
    });
  });

  return questions;
}

export function normalizeSprAnswer(val: string): number | string {
  const trimmed = (val || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 2) {
      const num = Number(parts[0]);
      const den = Number(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        return Math.round((num / den) * 10000) / 10000;
      }
    }
  }
  const parsed = Number(trimmed);
  if (!isNaN(parsed)) {
    return Math.round(parsed * 10000) / 10000;
  }
  return trimmed.toLowerCase();
}

export function isAnswerCorrect(question: SATQuestion, userAnswer?: string): boolean {
  if (!userAnswer || !userAnswer.trim()) return false;
  if (question.type === 'mcq') {
    return userAnswer.trim().toUpperCase() === question.correctAnswer.trim().toUpperCase();
  }
  // Student-Produced Response (supports fractions/decimals/multiple accepted values separated by comma)
  const acceptedList = question.correctAnswer.split(',').map((s) => s.trim());
  const normUser = normalizeSprAnswer(userAnswer);
  return acceptedList.some((acc) => normalizeSprAnswer(acc) === normUser);
}

export function calculateSATScore(
  questions: SATQuestion[],
  answers: Record<string, string>
): SATScoreReport {
  const moduleScores: Record<ModuleId, { correct: number; total: number; answered: number }> = {
    rw_1: { correct: 0, total: 0, answered: 0 },
    rw_2: { correct: 0, total: 0, answered: 0 },
    math_1: { correct: 0, total: 0, answered: 0 },
    math_2: { correct: 0, total: 0, answered: 0 },
  };

  for (const q of questions) {
    const bucket = moduleScores[q.moduleId];
    if (!bucket) continue;
    bucket.total += 1;
    const ans = answers[q.id];
    if (ans && ans.trim() !== '') {
      bucket.answered += 1;
      if (isAnswerCorrect(q, ans)) {
        bucket.correct += 1;
      }
    }
  }

  const rwRaw = moduleScores.rw_1.correct + moduleScores.rw_2.correct;
  const rwTotal = moduleScores.rw_1.total + moduleScores.rw_2.total || 54;
  const mathRaw = moduleScores.math_1.correct + moduleScores.math_2.correct;
  const mathTotal = moduleScores.math_1.total + moduleScores.math_2.total || 44;

  // College Board Digital SAT 200-800 scaled score calculation rounded to nearest 10
  const rwRatio = rwTotal > 0 ? rwRaw / rwTotal : 0;
  const mathRatio = mathTotal > 0 ? mathRaw / mathTotal : 0;

  const rwScaled = rwRaw === 0 ? 200 : Math.min(800, Math.max(200, Math.round((200 + rwRatio * 600) / 10) * 10));
  const mathScaled = mathRaw === 0 ? 200 : Math.min(800, Math.max(200, Math.round((200 + mathRatio * 600) / 10) * 10));

  const totalAnswered =
    moduleScores.rw_1.answered +
    moduleScores.rw_2.answered +
    moduleScores.math_1.answered +
    moduleScores.math_2.answered;
  const totalQuestions = rwTotal + mathTotal;
  const totalCorrect = rwRaw + mathRaw;
  const accuracyPercent = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  return {
    total: rwScaled + mathScaled,
    rwScaled,
    mathScaled,
    rwRaw,
    rwTotal,
    mathRaw,
    mathTotal,
    totalAnswered,
    totalQuestions,
    accuracyPercent,
    moduleScores,
  };
}
