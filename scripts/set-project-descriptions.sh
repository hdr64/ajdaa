#!/usr/bin/env bash
# Sets the SEO description (AR + EN) of 14 projects. Only "description", "descriptionEn" and "updatedAt" change.
# Usage on the server:  bash set-project-descriptions.sh [database]     (default database: ajda = production)
# Test first:           bash set-project-descriptions.sh ajda_test
# Read the "Check these first" list in docs/references/seo-project-descriptions.md before running on production.
set -euo pipefail

DB="${1:-ajda}"
BACKUP="$HOME/project-descriptions-before-${DB}-$(date +%Y%m%d-%H%M%S).sql"
PSQL=(sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1)

echo "Database: $DB"
read -r -p "Continue? (type yes) " ok
[ "$ok" = "yes" ] || { echo "Aborted."; exit 1; }

# 1) Backup: the current texts as restorable UPDATE statements.
"${PSQL[@]}" -At -c "SELECT format('UPDATE \"Project\" SET \"description\"=%L, \"descriptionEn\"=%L WHERE id=%s;', \"description\", \"descriptionEn\", id) FROM \"Project\" ORDER BY id;" > "$BACKUP"
echo "Backup: $BACKUP ($(wc -l < "$BACKUP") rows). Restore: sudo -u postgres psql -d $DB -f $BACKUP"

# 2) Update, all or nothing.
"${PSQL[@]}" <<'SQL'
BEGIN;
UPDATE "Project" SET
  "description" = $d$فندق ألما في حي الأعمال بالرياض، أحد مشاريع أجدا العقارية، بمساحة 5,000 م² وتصميم عصري يجمع بين الأناقة والوظيفة. المشروع مؤجر بالكامل، ويقدّم تجربة ضيافة متكاملة تعكس جودة مشاريع أجدا ورؤيتها في تطوير أصول عقارية ذات قيمة مستدامة.$d$,
  "descriptionEn" = $d$ALMA Hotel is an Ajda Real Estate project in Riyadh's business district, covering 5,000 m² with a contemporary design that balances elegance and function. Fully leased, it offers a complete hospitality experience and reflects Ajda's focus on real estate assets with lasting value.$d$,
  "updatedAt" = now()
WHERE id = 1;

UPDATE "Project" SET
  "description" = $d$أجدا HQ مبنى إداري في الرياض، وهو المقر الرئيسي لشركة أجدا العقارية، بمساحة 3,435 م². يجمع المشروع بين الموقع الاستراتيجي والتصميم العصري وجودة البناء، ويوفّر بيئة استثمارية متكاملة في أحد أهم المحاور التجارية بالمدينة. المشروع محجوز بالكامل.$d$,
  "descriptionEn" = $d$Ajda HQ is an office building in Riyadh and the head office of Ajda Real Estate, covering 3,435 m². It combines a strategic location, modern design and high-quality construction in one of the city's key commercial areas. The project is fully reserved.$d$,
  "updatedAt" = now()
WHERE id = 3;

UPDATE "Project" SET
  "description" = $d$مستودعات أجدا الكبير في حي الدار البيضاء بالرياض، بمساحة 2,875 م² ومواصفات تشغيلية عالية، وبموقع يسهّل الوصول إلى أهم الطرق والمحاور. صُممت لتوفير بيئة مثالية للتخزين والأنشطة اللوجستية بجاهزية كاملة وكفاءة تشغيلية عالية، والمشروع مؤجر بالكامل.$d$,
  "descriptionEn" = $d$Ajda Al Kabeer Warehouses in the Dar Al Baida district of Riyadh, 2,875 m² with high operating specifications and easy access to the main roads. Designed for storage and logistics with full readiness and high operating efficiency. Fully leased.$d$,
  "updatedAt" = now()
WHERE id = 4;

UPDATE "Project" SET
  "description" = $d$مستودعات الدمام مشروع لوجستي بمساحة 5,239 م² في موقع حيوي بالقرب من المحاور الرئيسية، متاح للتأجير. مستودعات حديثة بتصميم عملي وكفاءة تشغيلية عالية، مع ساحات ومواقف واسعة وسهولة دخول وخروج للشاحنات، وبنية تحتية جاهزة تدعم الأنشطة التجارية والصناعية الخفيفة.$d$,
  "descriptionEn" = $d$Dammam Warehouses is a 5,239 m² logistics project in a prime location near the main roads, available for lease. Modern warehouses with a practical design and high operating efficiency, wide yards and parking, easy truck access and ready infrastructure for commercial and light industrial activities.$d$,
  "updatedAt" = now()
WHERE id = 5;

UPDATE "Project" SET
  "description" = $d$عمارة السلي مبنى سكني وتجاري في الرياض بمساحة 5,681 م²، يضم شققاً ومتاجر للإيجار، وهو مؤجر بالكامل. أحد مشاريع أجدا العقارية للتطوير والاستثمار في العاصمة.$d$,
  "descriptionEn" = $d$Al Sulay Building is a residential and commercial building in Riyadh, covering 5,681 m² with apartments and shops for rent. Fully leased. One of Ajda Real Estate's development and investment projects in the capital.$d$,
  "updatedAt" = now()
WHERE id = 7;

UPDATE "Project" SET
  "description" = $d$فندق أنتور مشروع فندقي في مدينة جيزان بمساحة 1,000 م²، من مشاريع أجدا العقارية للتطوير والاستثمار. تم بيع المشروع، وهو ضمن سجل أعمال أجدا في قطاع الضيافة.$d$,
  "descriptionEn" = $d$Antour Hotel is a hospitality project in Jazan covering 1,000 m², developed by Ajda Real Estate. The project has been sold and is part of Ajda's track record in the hospitality sector.$d$,
  "updatedAt" = now()
WHERE id = 9;

UPDATE "Project" SET
  "description" = $d$مشروع فلل سكنية في الرياض يضم 250 فيلا مصممة وفق أحدث التصاميم المعمارية بما يناسب هدف العميل. من تطوير أجدا العقارية، وقد تم بيع المشروع.$d$,
  "descriptionEn" = $d$A residential villa project in Riyadh with 250 villas designed to the latest architectural standards and tailored to the client's goals. Developed by Ajda Real Estate and sold.$d$,
  "updatedAt" = now()
WHERE id = 10;

UPDATE "Project" SET
  "description" = $d$مستودعات المنصورية مشروع لوجستي في الرياض بمساحة 3,708 م²، متاح للتأجير، بأسقف مرتفعة وسعات تخزين كبيرة. يضم أرصفة شحن وتفريغ هيدروليكية ومواقف مخصصة للشاحنات والتريلات، مع أنظمة إطفاء وأمن معتمدة على مدار الساعة.$d$,
  "descriptionEn" = $d$Al Mansoria Warehouses is a 3,708 m² logistics project in Riyadh, available for lease, with high ceilings and large storage capacity. It has hydraulic loading and unloading docks, dedicated parking for trucks and trailers, and certified fire protection and 24/7 security systems.$d$,
  "updatedAt" = now()
WHERE id = 201;

UPDATE "Project" SET
  "description" = $d$مجمع الأحساء التجاري من مشاريع أجدا العقارية، بمساحة 4,600 م² ويضم محلات ومعارض تجارية بتصميم معماري يجمع بين الطابع التراثي والحداثة. يتميز بواجهات زجاجية مزدوجة واسعة وإضاءة ليلية متناسقة ومواقف واسعة للزوار، وهو مؤجر بالكامل.$d$,
  "descriptionEn" = $d$The Al Ahsa commercial complex is an Ajda Real Estate project covering 4,600 m², with shops and showrooms in an architecture that blends heritage character with modern design. It features wide double-glazed storefronts, coordinated night lighting and ample visitor parking. Fully leased.$d$,
  "updatedAt" = now()
WHERE id = 202;

UPDATE "Project" SET
  "description" = $d$أجدا لوكس مجمع محلات وصالات تجارية راقية في الدمام بمساحة 2,800 م²، متاح للتأجير. يتميز بواجهات عرض زجاجية مزدوجة وموقع تجاري نشط وحيوي، مع مواقف خاصة لعملاء المحلات ومواقف خلفية.$d$,
  "descriptionEn" = $d$Ajda Lux is a complex of upscale retail units and showrooms in Dammam, covering 2,800 m² and available for lease. It offers double-glazed display fronts in an active commercial location, with dedicated customer parking and rear parking.$d$,
  "updatedAt" = now()
WHERE id = 203;

UPDATE "Project" SET
  "description" = $d$أجدا فيرا صالات ومعارض تجارية كبرى في الرياض بمساحة 3,800 م²، متاحة للتأجير. مساحات عرض مفتوحة بأسقف مرتفعة ومواقف سيارات أمامية منظمة في موقع استراتيجي حيوي، تناسب العلامات التجارية والشركات.$d$,
  "descriptionEn" = $d$Ajda Vera offers large commercial showrooms in Riyadh, covering 3,800 m² and available for lease. Open display areas with high ceilings and organized front parking in a busy, strategic location, suited to brands and companies.$d$,
  "updatedAt" = now()
WHERE id = 204;

UPDATE "Project" SET
  "description" = $d$أجدا فيستا مبنى تجاري وإداري في الرياض بمساحة 2,409 م²، متاح للتأجير، ويضم مكاتب تجارية بمساحات متعددة. واجهات زجاجية عصرية عازلة، ومواقف خاصة وأنظمة أمن على مدار الساعة، مع أنظمة تكييف وتحكم ذكية.$d$,
  "descriptionEn" = $d$Ajda Vista is a commercial and office building in Riyadh, covering 2,409 m² and available for lease, with commercial offices in a range of sizes. It has modern insulated glass facades, private parking, 24/7 security and smart air-conditioning and control systems.$d$,
  "updatedAt" = now()
WHERE id = 205;

UPDATE "Project" SET
  "description" = $d$أجدا برايم مركز تجاري وإداري في الرياض بمساحة 7,200 م²، متاح للتأجير، بواجهة تجارية تتجاوز 200 متر وإطلالة على ثلاثة شوارع رئيسية. يقع مقابل المستشفى السعودي الألماني ونادي الشباب وقريباً من محطة مترو الرياض ومراكز الأعمال، ويضم معارض ومكاتب تنفيذية ومواقف منظمة ومصاعد سريعة ذكية وجلسات خارجية بإطلالات بانورامية.$d$,
  "descriptionEn" = $d$Ajda Prime is a commercial and office center in Riyadh, covering 7,200 m² and available for lease, with over 200 meters of commercial frontage on three main streets. Located opposite the Saudi German Hospital and Al Shabab Club, and close to a Riyadh Metro station and business centers, it offers showrooms, executive offices, organized parking, smart high-speed lifts and outdoor terraces with panoramic views.$d$,
  "updatedAt" = now()
WHERE id = 206;

UPDATE "Project" SET
  "description" = $d$مجمع أجدا لاين مجمع مكاتب وأقسام تجارية في الرياض بمساحة 5,793 م²، على شارع تجاري عند تقاطع طريقي الثمامة والجنادرية. قريب من مشروع الفرسان ومن مراكز تجارية، ويوفّر مواقف سيارات ومساحات مكتبية مرنة للمقرات الإدارية والشركات. المشروع مؤجر بالكامل.$d$,
  "descriptionEn" = $d$Ajda Line is a complex of offices and commercial units in Riyadh, covering 5,793 m², on a commercial street at the junction of Thumama Road and Al Janadriyah Road. Close to the Al Forsan project and to shopping centers, it offers parking and flexible office space for headquarters and companies. Fully leased.$d$,
  "updatedAt" = now()
WHERE id = 207;

COMMIT;
SQL

# 3) Check.
"${PSQL[@]}" -c "SELECT id, left(\"description\", 40) AS ar, left(\"descriptionEn\", 40) AS en FROM \"Project\" ORDER BY id;"
echo "Done. Open a project page to confirm."
