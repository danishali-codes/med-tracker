/**
 * Built-in list of common medicines so search works offline and knows brands sold
 * in the UAE and the Gulf, which the US RxNorm list doesn't have.
 * Each line is "Name|active ingredient(s)". Generic names map to themselves.
 */
const RAW = `
Panadol|paracetamol
Adol|paracetamol
Fevadol|paracetamol
Tylenol|paracetamol
Paracetamol|paracetamol
Panadol Extra|paracetamol / caffeine
Brufen|ibuprofen
Profinal|ibuprofen
Advil|ibuprofen
Ibuprofen|ibuprofen
Voltaren|diclofenac
Cataflam|diclofenac
Diclofenac|diclofenac
Naproxen|naproxen
Arcoxia|etoricoxib
Celebrex|celecoxib
Ponstan|mefenamic acid
Aspirin|aspirin
Aspocid|aspirin
Jusprin|aspirin
Tramal|tramadol
Tramadol|tramadol
Augmentin|amoxicillin / clavulanate
Amoxil|amoxicillin
Amoxicillin|amoxicillin
Zithromax|azithromycin
Azithromycin|azithromycin
Klacid|clarithromycin
Clarithromycin|clarithromycin
Ciprobay|ciprofloxacin
Ciprofloxacin|ciprofloxacin
Tavanic|levofloxacin
Levofloxacin|levofloxacin
Flagyl|metronidazole
Metronidazole|metronidazole
Doxycycline|doxycycline
Vibramycin|doxycycline
Keflex|cephalexin
Zinnat|cefuroxime
Suprax|cefixime
Macrobid|nitrofurantoin
Nitrofurantoin|nitrofurantoin
Diflucan|fluconazole
Fluconazole|fluconazole
Zovirax|acyclovir
Valtrex|valacyclovir
Tamiflu|oseltamivir
Zentel|albendazole
Glucophage|metformin
Metformin|metformin
Janumet|sitagliptin / metformin
Januvia|sitagliptin
Galvus|vildagliptin
Galvus Met|vildagliptin / metformin
Trajenta|linagliptin
Amaryl|glimepiride
Diamicron|gliclazide
Jardiance|empagliflozin
Synjardy|empagliflozin / metformin
Forxiga|dapagliflozin
Xigduo|dapagliflozin / metformin
Ozempic|semaglutide
Rybelsus|semaglutide
Wegovy|semaglutide
Mounjaro|tirzepatide
Saxenda|liraglutide
Victoza|liraglutide
Trulicity|dulaglutide
Lantus|insulin glargine
Toujeo|insulin glargine
Tresiba|insulin degludec
NovoRapid|insulin aspart
Humalog|insulin lispro
Concor|bisoprolol
Bisoprolol|bisoprolol
Betaloc|metoprolol
Metoprolol|metoprolol
Tenormin|atenolol
Inderal|propranolol
Dilatrend|carvedilol
Norvasc|amlodipine
Amlodipine|amlodipine
Exforge|amlodipine / valsartan
Diovan|valsartan
Co-Diovan|valsartan / hydrochlorothiazide
Cozaar|losartan
Losartan|losartan
Micardis|telmisartan
Olmetec|olmesartan
Atacand|candesartan
Aprovel|irbesartan
Coversyl|perindopril
Tritace|ramipril
Zestril|lisinopril
Enalapril|enalapril
Entresto|sacubitril / valsartan
Lasix|furosemide
Furosemide|furosemide
Aldactone|spironolactone
Natrilix|indapamide
Hydrochlorothiazide|hydrochlorothiazide
Imdur|isosorbide mononitrate
Nitroglycerin|nitroglycerin
Cordarone|amiodarone
Lanoxin|digoxin
Lipitor|atorvastatin
Atorvastatin|atorvastatin
Crestor|rosuvastatin
Rosuvastatin|rosuvastatin
Zocor|simvastatin
Ezetrol|ezetimibe
Atozet|ezetimibe / atorvastatin
Lipanthyl|fenofibrate
Plavix|clopidogrel
Clopidogrel|clopidogrel
Xarelto|rivaroxaban
Eliquis|apixaban
Pradaxa|dabigatran
Coumadin|warfarin
Warfarin|warfarin
Nexium|esomeprazole
Esomeprazole|esomeprazole
Losec|omeprazole
Omeprazole|omeprazole
Controloc|pantoprazole
Pantozol|pantoprazole
Pantoprazole|pantoprazole
Lansoprazole|lansoprazole
Famotidine|famotidine
Gaviscon|sodium alginate / sodium bicarbonate / calcium carbonate
Motilium|domperidone
Buscopan|hyoscine butylbromide
Duspatalin|mebeverine
Colospa|mebeverine
Imodium|loperamide
Duphalac|lactulose
Zofran|ondansetron
Zyrtec|cetirizine
Cetirizine|cetirizine
Claritine|loratadine
Telfast|fexofenadine
Aerius|desloratadine
Phenergan|promethazine
Singulair|montelukast
Montelukast|montelukast
Ventolin|salbutamol
Seretide|fluticasone / salmeterol
Symbicort|budesonide / formoterol
Pulmicort|budesonide
Flixotide|fluticasone
Mucosolvan|ambroxol
Prospan|ivy leaf extract
Euthyrox|levothyroxine
Eltroxin|levothyroxine
Synthroid|levothyroxine
Levothyroxine|levothyroxine
Neo-Mercazole|carbimazole
Prednisolone|prednisolone
Medrol|methylprednisolone
Dexamethasone|dexamethasone
Zyloric|allopurinol
Allopurinol|allopurinol
Colchicine|colchicine
Feburic|febuxostat
Fosamax|alendronate
Omnic|tamsulosin
Tamsulosin|tamsulosin
Proscar|finasteride
Propecia|finasteride
Viagra|sildenafil
Cialis|tadalafil
Prozac|fluoxetine
Fluoxetine|fluoxetine
Cipralex|escitalopram
Escitalopram|escitalopram
Zoloft|sertraline
Sertraline|sertraline
Seroxat|paroxetine
Cymbalta|duloxetine
Effexor|venlafaxine
Wellbutrin|bupropion
Remeron|mirtazapine
Xanax|alprazolam
Rivotril|clonazepam
Valium|diazepam
Ativan|lorazepam
Stilnox|zolpidem
Lyrica|pregabalin
Pregabalin|pregabalin
Neurontin|gabapentin
Gabapentin|gabapentin
Tegretol|carbamazepine
Depakine|valproate
Keppra|levetiracetam
Lamictal|lamotrigine
Topamax|topiramate
Seroquel|quetiapine
Risperdal|risperidone
Zyprexa|olanzapine
Abilify|aripiprazole
Concerta|methylphenidate
Ritalin|methylphenidate
Strattera|atomoxetine
Imigran|sumatriptan
Plaquenil|hydroxychloroquine
Methotrexate|methotrexate
Humira|adalimumab
Roaccutane|isotretinoin
Yasmin|drospirenone / ethinyl estradiol
Duphaston|dydrogesterone
Clomid|clomiphene
Neurobion|thiamine / pyridoxine / cyanocobalamin
Vitamin D3|cholecalciferol
Folic acid|folic acid
Ferrous sulfate|ferrous sulfate
Ferrograd|ferrous sulfate
Calcium carbonate|calcium carbonate
Caltrate|calcium carbonate / cholecalciferol
Omega-3|omega-3 fatty acids
Magnesium|magnesium
Zinc|zinc
Vitamin B12|cyanocobalamin
Melatonin|melatonin
Fucidin|fusidic acid
Bactroban|mupirocin
Betnovate|betamethasone
Hydrocortisone|hydrocortisone
`;

export interface CatalogEntry {
  name: string;
  generic: string;
}

export const CATALOG: CatalogEntry[] = RAW.trim()
  .split('\n')
  .map((l) => {
    const [name, generic] = l.split('|');
    return { name: name.trim(), generic: generic.trim() };
  });
