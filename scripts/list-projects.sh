#!/usr/bin/env bash
# Read-only: lists every project so you can check the ids before running set-project-descriptions.sh.
# Usage on the server:  bash list-projects.sh [database]     (default database: ajda = production)
set -euo pipefail

DB="${1:-ajda}"
PSQL=(sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1)

echo "Database: $DB"

"${PSQL[@]}" -c "SELECT id, \"publishStatus\" AS publish, type, \"title\" AS title_ar, \"titleEn\" AS title_en, \"city\" AS city_ar, \"cityEn\" AS city_en, area, \"status\" AS status_ar, left(\"description\", 30) AS desc_ar_start, left(\"descriptionEn\", 30) AS desc_en_start FROM \"Project\" ORDER BY id;"

echo
echo "Ids the description script will update: 1 3 4 5 7 9 10 201 202 203 204 205 206 207"
echo "Ids in the database that the script does NOT touch:"
"${PSQL[@]}" -At -c "SELECT id || ' | ' || \"title\" FROM \"Project\" WHERE id NOT IN (1,3,4,5,7,9,10,201,202,203,204,205,206,207) ORDER BY id;"
echo "Ids the script expects but the database does NOT have (an UPDATE on these would silently do nothing):"
"${PSQL[@]}" -At -c "SELECT v.id FROM (VALUES (1),(3),(4),(5),(7),(9),(10),(201),(202),(203),(204),(205),(206),(207)) AS v(id) LEFT JOIN \"Project\" p ON p.id = v.id WHERE p.id IS NULL ORDER BY v.id;"
echo "(empty list above = all expected ids exist)"
