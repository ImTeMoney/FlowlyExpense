// Maps category name keywords (Hebrew + English) → Lucide icon key.
// Checked case-insensitively; first match wins.
const RULES: [string[], string][] = [
  // Sports & fitness
  [['ספורט','sport','gym','גים','כושר','פאדל','padel','טניס','tennis','כדורגל','football','soccer',
    'כדורסל','basketball','שחייה','swimming','ריצה','running','פילאטיס','pilates','חדר כושר',
    'כדור','ball','squash','volleyball','כדורעף'], 'Dumbbell'],
  // Yoga
  [['יוגה','yoga','meditation','מדיטציה'], 'Activity'],
  // Coffee & cafe
  [['קפה','coffee','cafe','קפיטריה','espresso','cappuccino'], 'Coffee'],
  // Pizza
  [['פיצה','pizza'], 'Pizza'],
  // Beer & bar
  [['בר ','bar','בירה','beer','אלכוהול','alcohol','cocktail','pub','יין','wine'], 'Beer'],
  // Dining & restaurants
  [['מסעדה','restaurant','dining','ארוחה','meal','סושי','sushi'], 'UtensilsCrossed'],
  // Food & delivery
  [['אוכל','food','delivery','משלוח','וולט','wolt','מיסטר','mr.'], 'Truck'],
  // Groceries & supermarket
  [['סופר','supermarket','groceries','שוק','market','מכולת'], 'ShoppingCart'],
  // Pets
  [['חיות','pets','כלב','dog','חתול','cat','vet','וטרינר','animal'], 'PawPrint'],
  // Kids & childcare
  [['ילדים','kids','children','תינוק','baby','גן ','kindergarten','צהרון','babysitter'], 'Baby'],
  // Books
  [['ספר ','book','קריאה','reading','library','ספריה'], 'BookOpen'],
  // Education
  [['לימודים','education','school','בית ספר','קורס','course','university','אוניברסיטה','מכללה','לימוד'], 'GraduationCap'],
  // Music
  [['מוזיקה','music','spotify','גיטרה','guitar','קונצרט','concert','שירים'], 'Music'],
  // Gaming
  [['גיימינג','gaming','משחקים','games','playstation','xbox','nintendo','steam','גיים'], 'Gamepad2'],
  // Beauty & personal care
  [['יופי','beauty','תספורת','haircut','salon','מספרה','nail','spa','מניקור','pedicure','פדיקור'], 'Scissors'],
  // Pharmacy
  [['תרופות','pharmacy','בית מרקחת','medication','ויטמין','vitamin','supplement'], 'Pill'],
  // Doctor & health services
  [['רופא','doctor','hospital','בית חולים','מרפאה','clinic','קופת','kupat','health', 'בריאות'], 'Stethoscope'],
  // Gift & celebrations
  [['מתנה','gift','present','הפתעה','birthday','יומהולדת','חגיגה','celebration'], 'Gift'],
  // Clothes & fashion
  [['בגדים','clothes','fashion','מותג','brand','אופנה','store','חנות בגד','זארה','zara','h&m'], 'Shirt'],
  // Tech & electronics
  [['מחשב','computer','tech','טכנולוגיה','electronics','גאדג','gadget','מסך','screen','laptop'], 'Monitor'],
  // Phone & mobile
  [['טלפון','phone','mobile','סלולר','cellular','iphone','android','samsung'], 'Smartphone'],
  // Fuel & gas
  [['דלק','fuel','gas','בנזין','benzin','תדלוק'], 'Fuel'],
  // Car & vehicle
  [['רכב','car','vehicle','אוטו','auto','parking','חניה','טסט','test','גרר'], 'Car'],
  // Bike & scooter
  [['אופניים','bike','bicycle','cycling','scooter','קורקינט'], 'Bike'],
  // Bus & public transport
  [['אוטובוס','bus','train','רכבת','metro','subway','transit','תחבורה','רב קו','rav kav'], 'Bus'],
  // Travel & vacation
  [['טיול','travel','vacation','חופשה','תיירות','tourism','flight','טיסה','hotel','מלון','airbnb'], 'Plane'],
  // Rent & housing
  [['שכירות','rent','mortgage','משכנתא','דיור','housing','דירה','apartment','ועד בית','שכר דירה'], 'Home'],
  // Utilities & bills
  [['חשמל','electricity','מים','water','גז ','ארנונה','utilities','internet','cable','tv','ועד'], 'Zap'],
  // Insurance
  [['ביטוח','insurance','cover','הגנה','ביטחון'], 'Shield'],
  // Subscription & streaming
  [['מנוי','subscription','netflix','disney','prime','streaming','שירות','hbo','apple tv'], 'CreditCard'],
  // Savings & investment
  [['חיסכון','savings','investment','השקעה','פנסיה','pension','קרן השתלמות','גמל'], 'PiggyBank'],
  // Entertainment & shows
  [['בידור','entertainment','קולנוע','cinema','theater','תיאטרון','סרט','movie','show'], 'Clapperboard'],
  // Photography
  [['צילום','photography','camera','photo','תמונות','pictures'], 'Camera'],
  // Garden & nature
  [['גינה','garden','plants','צמחים','nature','עציץ','pot'], 'Leaf'],
  // Shopping (general)
  [['שופינג','shopping','purchase','אמזון','amazon','ebay','אלי אקספרס'], 'ShoppingBag'],
  // Trophy / competition
  [['תחרות','competition','trophy','award','prize','פרס','ספורטאי'], 'Trophy'],
];

/** Returns a Lucide icon key for the given category name, or undefined if no match. */
export function suggestIcon(name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [keywords, icon] of RULES) {
    if (keywords.some(k => lower.includes(k.toLowerCase()))) return icon;
  }
  return undefined;
}
