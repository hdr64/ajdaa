# Project descriptions for SEO (draft, 2026-11-07)

Working document: paste each text into the admin (Projects > edit > description AR / EN), then delete this file.
Source: the public production API (`/api/projects`) on 2026-11-07. Every sentence uses only data already stored for the project
(type, city, area, status, features). Nothing was invented. Google shows roughly the first 155 characters, so each text opens
with the project, the city and the key fact.

## Check these first (conflicts and gaps in the stored data)
- **Project 203 (Ajda Lux):** city field says Dammam (and the coordinates are Dammam) but the old description said Riyadh. Texts below use Dammam. Correct this if wrong.
- **Project 206 (Ajda Prime):** old description says King Fahd Road, the features list says near Anas Bin Malik Road. Texts below name neither road. Confirm which is right and add it.
- **Project 10 (villas):** the old text says 250 villas, the stored area is 5,000 m². These do not fit together. The text below uses 250 villas and leaves out the area. Confirm both numbers.
- **Project 207 (Ajda Line):** the features list says "close to Al Malik airport" which is unclear, so it is left out.
- **Names:** the title of 1 is spelled "الما", the old description "ألما"; 7 is "عماره السلي" (probably "عمارة"); 9 "انتور" (probably "أنتور"). Confirm the spelling before pasting.
- **Titles to change:** 206 uses stretched letters ("أجـــدا بــــرايــــم"), use "أجدا برايم". 10 "فلل سكنية" is generic, add the district or project name. English titles are missing for 1, 4, 5, 7 and 9, and the English titles of 9 and 10 are Arabic text. Suggested: 1 `ALMA Hotel`, 4 `Ajda Al Kabeer Warehouses`, 5 `Dammam Warehouses`, 7 `Al Sulay Building`, 9 `Antour Hotel Jazan`, 10 `Residential Villas`.
- **Projects 7, 9, 10 are the thinnest.** The texts below are short because only city, area, status and one feature exist. Add real facts (district, number of units, completion year, the buyer or tenant type if public) and they can be extended.

---

## 1 | فندق ألما (hotel, Riyadh, 5,000 m², fully leased)
**AR**
فندق ألما في حي الأعمال بالرياض، أحد مشاريع أجدا العقارية، بمساحة 5,000 م² وتصميم عصري يجمع بين الأناقة والوظيفة. المشروع مؤجر بالكامل، ويقدّم تجربة ضيافة متكاملة تعكس جودة مشاريع أجدا ورؤيتها في تطوير أصول عقارية ذات قيمة مستدامة.

**EN**
ALMA Hotel is an Ajda Real Estate project in Riyadh's business district, covering 5,000 m² with a contemporary design that balances elegance and function. Fully leased, it offers a complete hospitality experience and reflects Ajda's focus on real estate assets with lasting value.

## 3 | أجدا HQ (office, Riyadh, 3,435 m², fully reserved)
**AR**
أجدا HQ مبنى إداري في الرياض، وهو المقر الرئيسي لشركة أجدا العقارية، بمساحة 3,435 م². يجمع المشروع بين الموقع الاستراتيجي والتصميم العصري وجودة البناء، ويوفّر بيئة استثمارية متكاملة في أحد أهم المحاور التجارية بالمدينة. المشروع محجوز بالكامل.

**EN**
Ajda HQ is an office building in Riyadh and the head office of Ajda Real Estate, covering 3,435 m². It combines a strategic location, modern design and high-quality construction in one of the city's key commercial areas. The project is fully reserved.

## 4 | مستودعات أجدا الكبير (logistics, Riyadh, 2,875 m², fully leased)
**AR**
مستودعات أجدا الكبير في حي الدار البيضاء بالرياض، بمساحة 2,875 م² ومواصفات تشغيلية عالية، وبموقع يسهّل الوصول إلى أهم الطرق والمحاور. صُممت لتوفير بيئة مثالية للتخزين والأنشطة اللوجستية بجاهزية كاملة وكفاءة تشغيلية عالية، والمشروع مؤجر بالكامل.

**EN**
Ajda Al Kabeer Warehouses in the Dar Al Baida district of Riyadh, 2,875 m² with high operating specifications and easy access to the main roads. Designed for storage and logistics with full readiness and high operating efficiency. Fully leased.

## 5 | مستودعات الدمام (logistics, Dammam, 5,239 m², available for lease)
**AR**
مستودعات الدمام مشروع لوجستي بمساحة 5,239 م² في موقع حيوي بالقرب من المحاور الرئيسية، متاح للتأجير. مستودعات حديثة بتصميم عملي وكفاءة تشغيلية عالية، مع ساحات ومواقف واسعة وسهولة دخول وخروج للشاحنات، وبنية تحتية جاهزة تدعم الأنشطة التجارية والصناعية الخفيفة.

**EN**
Dammam Warehouses is a 5,239 m² logistics project in a prime location near the main roads, available for lease. Modern warehouses with a practical design and high operating efficiency, wide yards and parking, easy truck access and ready infrastructure for commercial and light industrial activities.

## 7 | عمارة السلي (residential, Riyadh, 5,681 m², fully leased)
**AR**
عمارة السلي مبنى سكني وتجاري في الرياض بمساحة 5,681 م²، يضم شققاً ومتاجر للإيجار، وهو مؤجر بالكامل. أحد مشاريع أجدا العقارية للتطوير والاستثمار في العاصمة.

**EN**
Al Sulay Building is a residential and commercial building in Riyadh, covering 5,681 m² with apartments and shops for rent. Fully leased. One of Ajda Real Estate's development and investment projects in the capital.

## 9 | فندق أنتور، جيزان (hotel, Jazan, 1,000 m², sold)
**AR**
فندق أنتور مشروع فندقي في مدينة جيزان بمساحة 1,000 م²، من مشاريع أجدا العقارية للتطوير والاستثمار. تم بيع المشروع، وهو ضمن سجل أعمال أجدا في قطاع الضيافة.

**EN**
Antour Hotel is a hospitality project in Jazan covering 1,000 m², developed by Ajda Real Estate. The project has been sold and is part of Ajda's track record in the hospitality sector.

## 10 | فلل سكنية (residential, Riyadh, sold)
**AR**
مشروع فلل سكنية في الرياض يضم 250 فيلا مصممة وفق أحدث التصاميم المعمارية بما يناسب هدف العميل. من تطوير أجدا العقارية، وقد تم بيع المشروع.

**EN**
A residential villa project in Riyadh with 250 villas designed to the latest architectural standards and tailored to the client's goals. Developed by Ajda Real Estate and sold.

## 201 | مستودعات المنصورية (logistics, Riyadh, 3,708 m², available for lease)
**AR**
مستودعات المنصورية مشروع لوجستي في الرياض بمساحة 3,708 م²، متاح للتأجير، بأسقف مرتفعة وسعات تخزين كبيرة. يضم أرصفة شحن وتفريغ هيدروليكية ومواقف مخصصة للشاحنات والتريلات، مع أنظمة إطفاء وأمن معتمدة على مدار الساعة.

**EN**
Al Mansoria Warehouses is a 3,708 m² logistics project in Riyadh, available for lease, with high ceilings and large storage capacity. It has hydraulic loading and unloading docks, dedicated parking for trucks and trailers, and certified fire protection and 24/7 security systems.

## 202 | مشروع الأحساء (commercial, Al Ahsa, 4,600 m², fully leased)
**AR**
مجمع الأحساء التجاري من مشاريع أجدا العقارية، بمساحة 4,600 م² ويضم محلات ومعارض تجارية بتصميم معماري يجمع بين الطابع التراثي والحداثة. يتميز بواجهات زجاجية مزدوجة واسعة وإضاءة ليلية متناسقة ومواقف واسعة للزوار، وهو مؤجر بالكامل.

**EN**
The Al Ahsa commercial complex is an Ajda Real Estate project covering 4,600 m², with shops and showrooms in an architecture that blends heritage character with modern design. It features wide double-glazed storefronts, coordinated night lighting and ample visitor parking. Fully leased.

## 203 | أجدا لوكس (commercial, Dammam, 2,800 m², available for lease)
**AR**
أجدا لوكس مجمع محلات وصالات تجارية راقية في الدمام بمساحة 2,800 م²، متاح للتأجير. يتميز بواجهات عرض زجاجية مزدوجة وموقع تجاري نشط وحيوي، مع مواقف خاصة لعملاء المحلات ومواقف خلفية.

**EN**
Ajda Lux is a complex of upscale retail units and showrooms in Dammam, covering 2,800 m² and available for lease. It offers double-glazed display fronts in an active commercial location, with dedicated customer parking and rear parking.

## 204 | أجدا فيرا (showrooms, Riyadh, 3,800 m², available for lease)
**AR**
أجدا فيرا صالات ومعارض تجارية كبرى في الرياض بمساحة 3,800 م²، متاحة للتأجير. مساحات عرض مفتوحة بأسقف مرتفعة ومواقف سيارات أمامية منظمة في موقع استراتيجي حيوي، تناسب العلامات التجارية والشركات.

**EN**
Ajda Vera offers large commercial showrooms in Riyadh, covering 3,800 m² and available for lease. Open display areas with high ceilings and organized front parking in a busy, strategic location, suited to brands and companies.

## 205 | أجدا فيستا (commercial and office building, Riyadh, 2,409 m², available for lease)
**AR**
أجدا فيستا مبنى تجاري وإداري في الرياض بمساحة 2,409 م²، متاح للتأجير، ويضم مكاتب تجارية بمساحات متعددة. واجهات زجاجية عصرية عازلة، ومواقف خاصة وأنظمة أمن على مدار الساعة، مع أنظمة تكييف وتحكم ذكية.

**EN**
Ajda Vista is a commercial and office building in Riyadh, covering 2,409 m² and available for lease, with commercial offices in a range of sizes. It has modern insulated glass facades, private parking, 24/7 security and smart air-conditioning and control systems.

## 206 | أجدا برايم (commercial and office center, Riyadh, 7,200 m², available for lease)
**AR**
أجدا برايم مركز تجاري وإداري في الرياض بمساحة 7,200 م²، متاح للتأجير، بواجهة تجارية تتجاوز 200 متر وإطلالة على ثلاثة شوارع رئيسية. يقع مقابل المستشفى السعودي الألماني ونادي الشباب وقريباً من محطة مترو الرياض ومراكز الأعمال، ويضم معارض ومكاتب تنفيذية ومواقف منظمة ومصاعد سريعة ذكية وجلسات خارجية بإطلالات بانورامية.

**EN**
Ajda Prime is a commercial and office center in Riyadh, covering 7,200 m² and available for lease, with over 200 meters of commercial frontage on three main streets. Located opposite the Saudi German Hospital and Al Shabab Club, and close to a Riyadh Metro station and business centers, it offers showrooms, executive offices, organized parking, smart high-speed lifts and outdoor terraces with panoramic views.

## 207 | أجدا لاين (commercial and office complex, Riyadh, 5,793 m², fully leased)
**AR**
مجمع أجدا لاين مجمع مكاتب وأقسام تجارية في الرياض بمساحة 5,793 م²، على شارع تجاري عند تقاطع طريقي الثمامة والجنادرية. قريب من مشروع الفرسان ومن مراكز تجارية، ويوفّر مواقف سيارات ومساحات مكتبية مرنة للمقرات الإدارية والشركات. المشروع مؤجر بالكامل.

**EN**
Ajda Line is a complex of offices and commercial units in Riyadh, covering 5,793 m², on a commercial street at the junction of Thumama Road and Al Janadriyah Road. Close to the Al Forsan project and to shopping centers, it offers parking and flexible office space for headquarters and companies. Fully leased.
