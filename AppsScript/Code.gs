// --- GLOBAL CONSTANTS ---
const SHEET_NAME = "shows";
const LOG_SHEET_NAME = "log";
const ICAL_SHEET_NAME = "iCalendar"; 
const PERSONS_SHEET_NAME = "persons";
const EMAIL_TEMPLATE_SHEET_NAME = "email template";
const CHECKLIST_TEMPLATE_ID = "14CaBOm_wNrV7xlQf4BTWxSvEEzTDJphpbgXyrHA7laM";
const TOTAL_COLUMNS = 37; 

const COUNTRY_MAP = {
  "US": "United States", "USA": "United States",
  "GB": "United Kingdom", "UK": "United Kingdom",
  "DE": "Germany", "FR": "France", "IT": "Italy", "ES": "Spain",
  "NL": "Netherlands", "CH": "Switzerland", "BE": "Belgium", "AT": "Austria",
  "PT": "Portugal", "GR": "Greece", "TR": "Turkey", "PL": "Poland",
  "SE": "Sweden", "NO": "Norway", "DK": "Denmark", "FI": "Finland",
  "IE": "Ireland", "CZ": "Czech Republic", "HU": "Hungary", "RO": "Romania",
  "HR": "Croatia", "RS": "Serbia", "SI": "Slovenia", "SK": "Slovakia",
  "RU": "Russia", "UA": "Ukraine", "GE": "Georgia", "AZ": "Azerbaijan",
  "BR": "Brazil", "AR": "Argentina", "MX": "Mexico", "CO": "Colombia",
  "CL": "Chile", "PE": "Peru", "UY": "Uruguay", "DO": "Dominican Republic",
  "CA": "Canada", "AU": "Australia", "NZ": "New Zealand",
  "CN": "China", "JP": "Japan", "KR": "South Korea", "TH": "Thailand",
  "ID": "Indonesia", "VN": "Vietnam", "IN": "India", "MY": "Malaysia",
  "SG": "Singapore", "PH": "Philippines",
  "AE": "United Arab Emirates", "SA": "Saudi Arabia", "QA": "Qatar",
  "EG": "Egypt", "MA": "Morocco", "ZA": "South Africa", "LB": "Lebanon",
  "IL": "Israel", "MC": "Monaco", "KE": "Kenya"
};

const COL_DATE = 0;
const COL_ARTISTS = 1;
const COL_VENUE = 2;
const COL_CITY = 3;
const COL_COUNTRY = 4;
const COL_SYSTEM_ID = 7;
const COL_FORMATTED_NAME = 8;
const COL_FOLDER_URL = 9;
const COL_CAPACITY = 14;
const COL_STATUS = 15; 
const COL_VENUE_LAT = 25;
const COL_VENUE_LNG = 26;
const COL_VENUE_URL = 24;
const COL_LD = 28;
const COL_LO = 29;
const COL_PM = 30;
const COL_SE = 31;
const COL_CHECKLIST_ID = 32;
const COL_CHECKLIST_COUNT = 33; 
const COL_FILE_COUNT = 34;
const COL_STAGE_TIME = 35; 
const COL_SETPIECE = 36; 

const HEADERS = [
    "Date", "Artists", "Venue", "City", "Country", "Sold Out", "Tickets Link", 
    "System ID", "Formatted Name", "Venue File Request Email", 
    "Event Name", "Event URL", "Performance Time", "Duration Days", "Capacity", 
    "Status Phase", "Production", "Doors Open", "Doors Close", "Venue Street", 
    "Venue State", "Venue Postal", "Venue Country Code", "Venue Phone", 
    "Venue URL", "Venue Lat", "Venue Lng", "Tickets On Sale",
    "Light Designer", "Light Operator", "Production Manager", "Sound Engineer", 
    "Checklist ID", "Checklist Progress", "Folder File Count", "Stage Time", "Setpiece"
];

function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Show Production Dashboard')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function generateSystemId(dateInput, artistsArray, timezone) {
   let dateKey;
   if (typeof dateInput === 'string' && dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
       dateKey = dateInput;
   } else {
       if (!dateInput || isNaN(new Date(dateInput).getTime())) return null;
       dateKey = Utilities.formatDate(new Date(dateInput), timezone, "yyyy-MM-dd");
   }
   
   let cleanArtists = [...new Set(artistsArray.map(a => a.trim()).filter(a => a))];
   if (cleanArtists.some(a => a.toLowerCase() === "keinemusik")) cleanArtists = ["Keinemusik"];
   const artistKey = cleanArtists.sort().join("").toLowerCase().replace(/[^a-z0-9]/g, "");
   
   return `ICAL_${dateKey}_${artistKey || 'unknown'}`;
}

function getCrewConfiguration() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const personsSheet = ss.getSheetByName(PERSONS_SHEET_NAME);
  const config = {
    byRole: { "Light Designer": [], "Light Operator": [], "Production Manager": [], "Sound Engineer": [] },
    byArtist: {},
    allArtists: new Set() 
  };
  if (!personsSheet) return config;
  const data = personsSheet.getDataRange().getValues();
  if (data.length < 2) return config;
  
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const idxName = headers.indexOf('name');
  const idxRole = headers.indexOf('role');
  const idxArtist = headers.indexOf('artist');
  if (idxName === -1) return config;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const name = row[idxName].toString().trim();
    if (!name) continue;
    if (idxArtist !== -1 && row[idxArtist]) {
       config.allArtists.add(row[idxArtist].toString().trim());
       const artist = row[idxArtist].toString().trim();
       if (!config.byArtist[artist]) config.byArtist[artist] = {};
       if (idxRole !== -1) {
         const rawRoles = row[idxRole].toString().split(',').map(r => r.trim());
         rawRoles.forEach(role => {
            if (config.byRole.hasOwnProperty(role)) config.byRole[role].push(name);
            if (!config.byArtist[artist][role]) config.byArtist[artist][role] = [];
            config.byArtist[artist][role].push(name);
         });
       }
    }
  }
  for (let r in config.byRole) config.byRole[r].sort();
  return config;
}

function getEmailTemplates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(EMAIL_TEMPLATE_SHEET_NAME);
  const templates = {};
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const artist = data[i][0].toString().trim().toLowerCase();
      const message = data[i][1].toString();
      if (artist) templates[artist] = message;
    }
  }
  return templates;
}

function getRecentLogs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!logSheet) return [];
  const lastRow = logSheet.getLastRow();
  if (lastRow < 2) return [];
  const startRow = Math.max(2, lastRow - 9);
  const numRows = lastRow - startRow + 1;
  const data = logSheet.getRange(startRow, 1, numRows, 3).getValues();
  return data.reverse().map(row => ({
    date: Utilities.formatDate(new Date(row[0]), ss.getSpreadsheetTimeZone(), "MM-dd HH:mm"),
    type: row[1],
    desc: row[2]
  }));
}

function getAllData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let showSheet = ss.getSheetByName(SHEET_NAME);
    if (!showSheet) {
      showSheet = ss.insertSheet(SHEET_NAME);
      showSheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
    }
    const currentMaxCols = showSheet.getMaxColumns();
    if (currentMaxCols < TOTAL_COLUMNS) {
      showSheet.insertColumnsAfter(currentMaxCols, TOTAL_COLUMNS - currentMaxCols);
    }
    const crewConfig = getCrewConfiguration();
    const emailTemplates = getEmailTemplates();
    const lastRow = showSheet.getLastRow();
    let shows = [];
    const allArtistsSet = crewConfig.allArtists;
    
    if (lastRow > 1) {
      const dataRange = showSheet.getRange(2, 1, lastRow - 1, TOTAL_COLUMNS);
      const dataValues = dataRange.getValues();
      const timezone = ss.getSpreadsheetTimeZone();
      
      shows = dataValues.map((row, index) => {
        let rowDate = row[COL_DATE];
        let dateStr = rowDate instanceof Date ? Utilities.formatDate(rowDate, timezone, "yyyy-MM-dd") : String(rowDate);
        const emailContent = (row[COL_FOLDER_URL] || '').toString();
        const folderLinkMatch = emailContent.match(/(http[s]?:\/\/[^\s]+)/i);
        const folderUrl = folderLinkMatch ? folderLinkMatch[0] : '';
        const progressRaw = (row[COL_CHECKLIST_COUNT] || "").toString();
        const progressParts = progressRaw.split(',');
        const checked = parseInt(progressParts[0]) || 0;
        const total = parseInt(progressParts[1]) || 0;
        let artists = row[COL_ARTISTS] ? row[COL_ARTISTS].toString().split(',').map(s => s.trim()) : [];
        if (artists.some(a => a.toLowerCase() === "keinemusik")) {
            artists = ["Keinemusik"];
        } else {
            artists.forEach(p => allArtistsSet.add(p.trim()));
        }

        return {
          rowIndex: index + 2,
          date: dateStr,
          artists: artists,
          city: row[COL_CITY],
          country: row[COL_COUNTRY],
          venue: row[COL_VENUE],
          venueUrl: row[COL_VENUE_URL],
          id: row[COL_SYSTEM_ID],
          name: row[COL_FORMATTED_NAME],
          capacity: row[COL_CAPACITY],
          stageTime: row[COL_STAGE_TIME],
          setpiece: row[COL_SETPIECE],
          status: row[COL_STATUS],
          ticketsLink: row[6], 
          ld: row[COL_LD] ? row[COL_LD].toString().split(',').map(s => s.trim()) : [],
          lo: row[COL_LO] ? row[COL_LO].toString().split(',').map(s => s.trim()) : [],
          pm: row[COL_PM] ? row[COL_PM].toString().split(',').map(s => s.trim()) : [],
          se: row[COL_SE] ? row[COL_SE].toString().split(',').map(s => s.trim()) : [],
          checklistId: row[COL_CHECKLIST_ID],
          checklistChecked: checked,
          checklistTotal: total,
          folderUrl: folderUrl,
          fileCount: parseInt(row[COL_FILE_COUNT]) || 0,
          lat: parseFloat(row[COL_VENUE_LAT]) || null,
          lng: parseFloat(row[COL_VENUE_LNG]) || null,
          colIndices: {
             artists: COL_ARTISTS + 1,
             ld: COL_LD + 1,
             lo: COL_LO + 1,
             pm: COL_PM + 1,
             se: COL_SE + 1,
             capacity: COL_CAPACITY + 1,
             stageTime: COL_STAGE_TIME + 1,
             setpiece: COL_SETPIECE + 1,
             status: COL_STATUS + 1, 
             checklistId: COL_CHECKLIST_ID + 1,
             checklistCount: COL_CHECKLIST_COUNT + 1
          }
        };
      }).filter(show => show.id);
      shows.sort((a, b) => a.date.localeCompare(b.date));
    }
    return { shows, crewOptions: crewConfig.byRole, artistOptions: Array.from(allArtistsSet).sort(), emailTemplates: emailTemplates };
  } catch (error) {
    console.error("FATAL ERROR in getAllData: " + error.toString());
    return { error: error.toString() };
  }
}

function updateShowData(update) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    let valToSet = update.value;
    if (Array.isArray(valToSet)) valToSet = valToSet.join(', ');
    sheet.getRange(update.rowIndex, update.colIndex).setValue(valToSet);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function deleteShows(rowsToDelete) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    let logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    const logBuffer = [];

    rowsToDelete.sort((a, b) => b.rowIndex - a.rowIndex);
    rowsToDelete.forEach(show => {
        sheet.deleteRow(show.rowIndex);
        logBuffer.push([new Date(), "Deleted Show", `Removed cancelled/missing show: ${show.name} on ${show.date}`]);
    });

    if (logBuffer.length > 0 && logSheet) {
        logSheet.getRange(logSheet.getLastRow() + 1, 1, logBuffer.length, 3).setValues(logBuffer);
    }
    return true;
  } catch (e) {
    console.error("deleteShows Error: " + e.toString());
    throw new Error(e.toString());
  }
}

function syncApiData(isManual = false) {
  const START_TIME = Date.now();
  const MAX_RUNTIME_MS = 270 * 1000; 
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timezone = ss.getSpreadsheetTimeZone();
  const logBuffer = [];
  const detailedLogs = []; 
  
  const addLog = (type, desc) => { logBuffer.push([new Date(), type, desc]); };

  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { message: "No sheet found.", logs: ["Error: No Shows sheet found."] };
  
  detailedLogs.push("--- CHECKING FOR CANCELLED SHOWS ---");
  const initialLastRow = sheet.getLastRow();
  if (initialLastRow > 1) {
    const initialData = sheet.getRange(2, 1, initialLastRow - 1, TOTAL_COLUMNS).getValues();
    const cancelledRows = [];
    initialData.forEach((row, idx) => {
      if (row[COL_STATUS] === "Cancelled") {
        cancelledRows.push({ rowIndex: idx + 2, name: row[COL_FORMATTED_NAME] || "Unknown", date: row[COL_DATE] });
        detailedLogs.push(`Found Cancelled show in sheet: ${row[COL_CITY] || row[COL_VENUE]}. Queueing for deletion.`);
      }
    });
    if (cancelledRows.length > 0) {
       deleteShows(cancelledRows);
       detailedLogs.push(`Deleted ${cancelledRows.length} cancelled shows from sheet.`);
    } else {
       detailedLogs.push(`No cancelled shows to delete.`);
    }
  }

  const icalSheet = ss.getSheetByName(ICAL_SHEET_NAME);
  if (!icalSheet) return { message: "No iCal sheet found.", logs: ["Error: No iCal URLs sheet found."] };
  
  let logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!logSheet) {
    logSheet = ss.insertSheet(LOG_SHEET_NAME);
    logSheet.appendRow(["Timestamp", "Type", "Description"]);
    logSheet.getRange(1,1,1,3).setFontWeight("bold");
  }

  const crewConfig = getCrewConfiguration();
  const artistMap = crewConfig.byArtist;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const feedData = icalSheet.getDataRange().getValues(); 
  const showsMap = new Map(); 
  
  const firstUrl = feedData.length > 0 && feedData[0][1] ? feedData[0][1].toString().toLowerCase() : "";
  const startRow = (firstUrl.startsWith("http") || firstUrl.startsWith("webcal")) ? 0 : 1;

  detailedLogs.push("\n--- PARSING CALENDARS ---");

  for (let i = startRow; i < feedData.length; i++) {
    const defaultArtist = feedData[i][0];
    let url = (feedData[i][1] || "").toString().trim();
    if (!url) continue;

    if (url.startsWith("webcal://")) url = "https://" + url.substring(9);
    if (!url.startsWith("http")) {
       detailedLogs.push(`Invalid URL for ${defaultArtist}: ${url}`);
       continue;
    }

    const events = fetchAndParseICal(url);
    detailedLogs.push(`\nFetched ${defaultArtist} feed: Found ${events.length} total blocks.`);
    
    events.forEach(evt => {
      if (evt.skipped) {
          detailedLogs.push(`  Skipped: "${evt.rawSummary}" (${evt.reason})`);
          return;
      }
      
      const checkDate = new Date(evt.date);
      checkDate.setHours(0,0,0,0);
      if (checkDate < today) return; 

      const allEvtArtists = [...evt.artists, defaultArtist];
      const baseId = generateSystemId(evt.dateStr, allEvtArtists, timezone);

      // --- DUPLICATE MERGE / COLLISION HANDLER ---
      let uniqueId = baseId;
      let counter = 1;
      let checkId = baseId;
      let merged = false;
      
      while (showsMap.has(checkId)) {
          const existing = showsMap.get(checkId);
          
          const c1 = (existing.city || "").toLowerCase().replace(/[^a-z]/g, "");
          const c2 = (evt.city || "").toLowerCase().replace(/[^a-z]/g, "");
          const v1 = (existing.venue || "").toLowerCase().replace(/[^a-z]/g, "");
          const v2 = (evt.venue || "").toLowerCase().replace(/[^a-z]/g, "");
          
          let isSameShow = true;
          // If venues are explicitly different (Double Header)
          if (v1 && v2 && v1 !== v2) isSameShow = false;
          // If cities are explicitly different (Travel Day/Double Header)
          else if (c1 && c2 && c1 !== c2) isSameShow = false;
          
          if (isSameShow) {
              uniqueId = checkId;
              merged = true;
              break;
          }
          
          counter++;
          checkId = `${baseId}-${counter}`;
      }
      
      if (!merged) {
          uniqueId = checkId;
      }

      detailedLogs.push(`  Valid Event Parsed: ${evt.dateStr} | City: ${evt.city || 'TBC'} | Venue: ${evt.venue || 'TBC'} | Assigned ID: ${uniqueId}`);

      let lat = "", lng = "";
      if (Date.now() - START_TIME < MAX_RUNTIME_MS) {
        if (!evt.lat && evt.city && evt.country) {
           try {
             Utilities.sleep(100); 
             const geo = Maps.newGeocoder().geocode(`${evt.venue || ''} ${evt.city} ${evt.country}`);
             if (geo.status === "OK" && geo.results.length > 0) {
               const loc = geo.results[0].geometry.location;
               lat = loc.lat;
               lng = loc.lng;
             }
           } catch(e) {}
        }
      }

      if (!showsMap.has(uniqueId)) {
        showsMap.set(uniqueId, {
          id: uniqueId, date: evt.date, city: evt.city, venue: evt.venue, country: evt.country,
          capacity: evt.capacity || "", doors: evt.doors || "", time: evt.time || "",
          stageTime: evt.stageTime || "",
          artists: [], formattedName: "", description: evt.description, lat: lat, lng: lng
        });
      }
      const entry = showsMap.get(uniqueId);
      if (evt.artists && evt.artists.length > 0) {
         evt.artists.forEach(a => { if (!entry.artists.includes(a)) entry.artists.push(a); });
      }
      const artName = defaultArtist || "Unknown";
      if (!entry.artists.includes(artName)) entry.artists.push(artName);
      
      if (!entry.venue && evt.venue) entry.venue = evt.venue;
      if (!entry.capacity && evt.capacity) entry.capacity = evt.capacity;
      if (!entry.stageTime && evt.stageTime) entry.stageTime = evt.stageTime;
      if (!entry.time && evt.time) entry.time = evt.time;
      if (!entry.lat && lat) { entry.lat = lat; entry.lng = lng; }
    });
  }

  detailedLogs.push("\n--- COMPARING TO SPREADSHEET ---");
  const newLastRow = sheet.getLastRow();
  let existingData = [];
  if (newLastRow > 1) existingData = sheet.getRange(2, 1, newLastRow - 1, TOTAL_COLUMNS).getValues();
  
  const sheetMap = new Map();
  existingData.forEach((row, idx) => {
    const d = new Date(row[COL_DATE]);
    if (isNaN(d.getTime())) return;
    const artistsArr = row[COL_ARTISTS] ? row[COL_ARTISTS].toString().split(',') : [];
    const baseId = generateSystemId(d, artistsArr, timezone);
    if (baseId) {
        let rowId = row[COL_SYSTEM_ID];
        // Heal or protect existing ID (-2, -3 suffixes)
        if (!rowId || !rowId.toString().startsWith(baseId)) {
            let finalId = baseId;
            let counter = 2;
            while (sheetMap.has(finalId)) { finalId = `${baseId}-${counter}`; counter++; }
            rowId = finalId;
        }
        sheetMap.set(rowId, { rowIndex: idx + 2, row: row });
    }
  });
  
  const newRows = [];
  let updateCount = 0;
  
  const isPlaceholder = (val) => {
     if(!val) return true;
     const s = val.toString().trim().toUpperCase();
     return s === "" || s === "TBC" || s === "TBA";
  };
  
  const valDiffers = (a, b) => {
     const strA = (a || "").toString().trim();
     const strB = (b || "").toString().trim();
     return strA !== strB;
  };
  
  showsMap.forEach((show, uniqueId) => {
    const lookupKey = show.id;

    if (sheetMap.has(lookupKey)) {
        const match = sheetMap.get(lookupKey);
        const existingRow = match.row;
        let isUpdated = false;

        if (existingRow[COL_SYSTEM_ID] !== show.id) {
           sheet.getRange(match.rowIndex, COL_SYSTEM_ID + 1).setValue(show.id);
        }

        const existingArtists = (existingRow[COL_ARTISTS] || "").toString().split(',').map(s => s.trim()).filter(s => s);
        const newArtists = show.artists;
        let combinedArtists = [...existingArtists];
        newArtists.forEach(na => {
            if (!combinedArtists.includes(na)) {
                combinedArtists.push(na);
                isUpdated = true;
            }
        });
        
        if (isUpdated) {
           sheet.getRange(match.rowIndex, COL_ARTISTS + 1).setValue(combinedArtists.join(", "));
           addLog("Artist Update", `Updated artists for ${show.city}: ${combinedArtists.join(", ")}`);
        }
        
        let changesMade = [];
        if (show.venue && isPlaceholder(existingRow[COL_VENUE]) && valDiffers(existingRow[COL_VENUE], show.venue)) {
             sheet.getRange(match.rowIndex, COL_VENUE + 1).setValue(show.venue);
             changesMade.push("Venue");
        }
        if (show.country && isPlaceholder(existingRow[COL_COUNTRY]) && valDiffers(existingRow[COL_COUNTRY], show.country)) {
             sheet.getRange(match.rowIndex, COL_COUNTRY + 1).setValue(show.country);
             changesMade.push("Country");
        }
        if (show.capacity && isPlaceholder(existingRow[COL_CAPACITY]) && valDiffers(existingRow[COL_CAPACITY], show.capacity)) {
             sheet.getRange(match.rowIndex, COL_CAPACITY + 1).setValue(show.capacity);
             changesMade.push("Capacity");
        }
        if (show.stageTime && isPlaceholder(existingRow[COL_STAGE_TIME]) && valDiffers(existingRow[COL_STAGE_TIME], show.stageTime)) {
             sheet.getRange(match.rowIndex, COL_STAGE_TIME + 1).setValue(show.stageTime);
             changesMade.push("StageTime");
        }
        if (show.city && isPlaceholder(existingRow[COL_CITY]) && valDiffers(existingRow[COL_CITY], show.city)) {
             sheet.getRange(match.rowIndex, COL_CITY + 1).setValue(show.city);
             changesMade.push("City");
        }

        if ((!existingRow[COL_VENUE_LAT] || !existingRow[COL_VENUE_LNG]) && show.lat) {
             sheet.getRange(match.rowIndex, COL_VENUE_LAT + 1).setValue(show.lat);
             sheet.getRange(match.rowIndex, COL_VENUE_LNG + 1).setValue(show.lng);
        }
        
        if (changesMade.length > 0 || isUpdated) {
             detailedLogs.push(`Updated existing show (${show.id}): Overwrote [${changesMade.join(", ")}]`);
             updateCount++;
        }
    } else {
        detailedLogs.push(`Creating NEW show in sheet: ${show.date.toISOString().split('T')[0]} | ${show.city || 'TBC'} (${show.id})`);
        
        let folderInfo = null;
        if (Date.now() - START_TIME < MAX_RUNTIME_MS) {
           const artistString = show.artists.join(", ");
           const yyyy = show.date.getFullYear();
           const mm = String(show.date.getMonth() + 1).padStart(2, '0');
           const dd = String(show.date.getDate()).padStart(2, '0');
           const fmtName = `${yyyy}.${mm}.${dd} - ${show.city} (${artistString})`;
           folderInfo = ensureFolderAndChecklist(fmtName, artistString);
        }

        const folderLink = folderInfo ? `Please upload files...\n\n${folderInfo.url}` : "";
        const checklistId = folderInfo ? folderInfo.checklistId : "";
        const checklistCount = folderInfo ? folderInfo.checklistCount : "";
        const fileCount = folderInfo ? folderInfo.fileCount : 0;
        
        let ld = [], lo = [], pm = [], se = [];
        show.artists.forEach(art => {
          if (artistMap[art]) {
            if (artistMap[art]["Light Designer"]) ld.push(...artistMap[art]["Light Designer"]);
            if (artistMap[art]["Light Operator"]) lo.push(...artistMap[art]["Light Operator"]);
            if (artistMap[art]["Production Manager"]) pm.push(...artistMap[art]["Production Manager"]);
            if (artistMap[art]["Sound Engineer"]) se.push(...artistMap[art]["Sound Engineer"]);
          }
        });

        const artistString = show.artists.join(", ");
        const yyyy = show.date.getFullYear();
        const mm = String(show.date.getMonth() + 1).padStart(2, '0');
        const dd = String(show.date.getDate()).padStart(2, '0');
        const fmtName = `${yyyy}.${mm}.${dd} - ${show.city} (${artistString})`;

        const apiRow = new Array(TOTAL_COLUMNS).fill("");
        apiRow[COL_DATE] = show.date;
        apiRow[COL_ARTISTS] = artistString;
        apiRow[COL_VENUE] = show.venue;
        apiRow[COL_CITY] = show.city;
        apiRow[COL_COUNTRY] = show.country;
        apiRow[5] = "No";
        apiRow[COL_SYSTEM_ID] = show.id;
        apiRow[COL_FORMATTED_NAME] = fmtName;
        apiRow[COL_FOLDER_URL] = folderLink;
        apiRow[12] = show.time;
        apiRow[COL_CAPACITY] = show.capacity;
        apiRow[17] = show.doors;
        apiRow[COL_VENUE_LAT] = show.lat;
        apiRow[COL_VENUE_LNG] = show.lng;
        apiRow[COL_LD] = [...new Set(ld)].join(", ");
        apiRow[COL_LO] = [...new Set(lo)].join(", ");
        apiRow[COL_PM] = [...new Set(pm)].join(", ");
        apiRow[COL_SE] = [...new Set(se)].join(", ");
        apiRow[COL_CHECKLIST_ID] = checklistId;
        apiRow[COL_CHECKLIST_COUNT] = checklistCount;
        apiRow[COL_FILE_COUNT] = fileCount;
        apiRow[COL_STAGE_TIME] = show.stageTime;
        apiRow[COL_SETPIECE] = "";

        newRows.push(apiRow);
        addLog("New Show", `Added show: ${fmtName}`);
    }
  });

  if (newRows.length > 0) {
    newRows.sort((a,b) => a[0] - b[0]);
    sheet.getRange(newLastRow + 1, 1, newRows.length, TOTAL_COLUMNS).setValues(newRows);
    sheet.getRange(newLastRow + 1, 1, newRows.length, 1).setNumberFormat("yyyy-mm-dd");
  }

  const orphans = [];
  if (isManual) {
     detailedLogs.push("\n--- CHECKING FOR MISSING SHOWS (ORPHANS) ---");
     sheetMap.forEach((match, healedId) => {
        const row = match.row;
        const dateVal = new Date(row[COL_DATE]);
        if (dateVal >= today && healedId.startsWith("ICAL_")) {
           if (!showsMap.has(healedId)) {
              orphans.push({
                 id: healedId,
                 rowIndex: match.rowIndex,
                 name: row[COL_FORMATTED_NAME] || `${row[COL_CITY]} (${row[COL_ARTISTS]})`,
                 date: Utilities.formatDate(dateVal, timezone, "yyyy-MM-dd")
              });
              detailedLogs.push(`Missing from Feed: ${Utilities.formatDate(dateVal, timezone, "yyyy-MM-dd")} | ${row[COL_CITY]} (${healedId})`);
           }
        }
     });
  }

  let backfillCount = 0;
  for (let i = 0; i < existingData.length; i++) {
    if (Date.now() - START_TIME > MAX_RUNTIME_MS) break;
    const row = existingData[i];
    const rawChkId = row[COL_CHECKLIST_ID];
    const fmtName = row[COL_FORMATTED_NAME];
    const artStr = row[COL_ARTISTS];
    const rowDateVal = row[COL_DATE];
    let rowDate = new Date(rowDateVal);
    if (isNaN(rowDate.getTime())) continue; 
    rowDate.setHours(0,0,0,0);
    if (rowDate < today) continue; 
    const isInvalidId = !rawChkId || rawChkId.toString().length < 20 || rawChkId.toString().includes(" ");
    const hasFolder = !!row[COL_FOLDER_URL];

    if (fmtName && (isInvalidId || hasFolder)) {
      const info = ensureFolderAndChecklist(fmtName, artStr);
      if (info) {
        const realRow = i + 2;
        if (!row[COL_FOLDER_URL]) sheet.getRange(realRow, COL_FOLDER_URL + 1).setValue(`Please upload files...\n\n${info.url}`);
        if (isInvalidId && info.checklistId) {
           sheet.getRange(realRow, COL_CHECKLIST_ID + 1).setValue(info.checklistId);
           sheet.getRange(realRow, COL_CHECKLIST_COUNT + 1).setValue(info.checklistCount);
           backfillCount++;
        }
        sheet.getRange(realRow, COL_FILE_COUNT + 1).setValue(info.fileCount);
      }
    }
  }
  
  if (logBuffer.length > 0) {
    logSheet.getRange(logSheet.getLastRow() + 1, 1, logBuffer.length, 3).setValues(logBuffer);
  }
  
  detailedLogs.push(`\nSYNC COMPLETE: Added ${newRows.length}, Updated ${updateCount}, Missing ${orphans.length}.`);

  return {
    message: `Synced ${newRows.length} new. Updated ${updateCount}. Backfilled ${backfillCount}. Logs: ${logBuffer.length}`,
    orphans: orphans,
    logs: detailedLogs
  };
}

function fetchAndParseICal(url, isDebugVerbose = false) {
  try {
    const response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    const httpCode = response.getResponseCode();
    
    if (httpCode !== 200) {
        if (isDebugVerbose) console.error(`Fetch failed for ${url} with HTTP code ${httpCode}`);
        return [];
    }
    
    const text = response.getContentText();
    if (!text.includes("BEGIN:VEVENT")) {
        if (isDebugVerbose) console.error(`No iCal data found at ${url}. Response starts with: ${text.substring(0, 50)}...`);
        return [];
    }
    
    const events = [];
    const rawEvents = text.split("BEGIN:VEVENT");
    
    const rgxStart = /DTSTART(?:;.*?)?:(\w+)/;
    const rgxSummary = /SUMMARY:(.*)/;
    const rgxCap = /Capacity:\s*(\d+)/i;
    const rgxDoors = /Doors open:\s*([\d:]+)/i;
    const rgxTime = /Stage time:\s*(.*)|Time:\s*(.*)/i;
    const rgxStageTimeDesc = /Stage time:([^\n]*)/i;
    
    for (let i = 1; i < rawEvents.length; i++) {
      const block = rawEvents[i];
      const unfolded = block.replace(/\r\n\s/g, ""); 
      
      let rawSummary = "";
      const mSum = unfolded.match(rgxSummary);
      if (mSum) rawSummary = mSum[1].trim();
      
      const isLikelyShow = rawSummary.includes(" @ ") || rawSummary.includes(" - ");
      if (!isLikelyShow && rawSummary.match(/(\s»\s|Flight\s|\[[A-Z]{3}\]|\b[A-Z]{2}\s?\d{3,4}\b)/i)) {
         events.push({ skipped: true, rawSummary, reason: "Matched flight regex" });
         continue;
      }

      let summary = rawSummary.replace(/\\,/g, ",");
      if (summary.includes("»")) continue; 

      let date = new Date();
      let dateStr = "";
      const mStart = unfolded.match(rgxStart);
      if (mStart) {
        const dStr = mStart[1];
        const y = parseInt(dStr.substr(0,4));
        const m = parseInt(dStr.substr(4,2)) - 1;
        const d = parseInt(dStr.substr(6,2));
        dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        date = new Date(Date.UTC(y, m, d));
      }
      
      let description = "";
      const mDesc = unfolded.match(/DESCRIPTION:(.*?)(\r\n[A-Z]+[:;]|\r\nEND:VEVENT)/s);
      if (mDesc) description = mDesc[1].replace(/\\n/g, "\n").replace(/\\,/g, ",");
      
      let venue = "";
      let city = "";
      let country = "";
      let artists = [];
      let titleBlob = summary;
      
      let artistPart = titleBlob;
      let locationPart = "";

      if (titleBlob.includes("@")) {
         const splitAt = titleBlob.split("@");
         artistPart = splitAt[0].trim();
         locationPart = splitAt[1].trim(); 
      } else if (titleBlob.includes(" - ")) {
         const splitDash = titleBlob.split(" - ");
         artistPart = splitDash[0].trim();
         locationPart = splitDash.slice(1).join(" - ").trim();
      }

      artists = artistPart.split(/,\s*|\s+and\s+|\s+vs\s+/i).map(s => s.trim()).filter(s => s.length > 0);

      if (!city && locationPart) {
        const dashParts = locationPart.split(" - ").map(s => s.trim());
        if (dashParts.length >= 3) {
            country = dashParts[dashParts.length-1];
            city = dashParts[dashParts.length-2];
            venue = dashParts.slice(0, dashParts.length-2).join(" - ");
        } else if (dashParts.length === 2) {
            city = dashParts[0];
            country = dashParts[1];
        } else {
            city = dashParts[0];
        }
      }
      
      const linesArr = description.split('\n').map(s => s.trim());
      const vIdx = linesArr.findIndex(l => l.toUpperCase() === "VENUE");
      if (vIdx !== -1) {
          const vLines = [];
          for (let k = vIdx + 1; k < linesArr.length; k++) {
              if (linesArr[k] === "") continue;
              if (linesArr[k].includes("---") || linesArr[k].toUpperCase().startsWith("CAPACITY") || linesArr[k].toUpperCase().startsWith("PROMOTER")) break;
              vLines.push(linesArr[k]);
          }
          if (vLines.length > 0) {
              if (vLines.length === 1) {
                  venue = vLines[0];
              } else if (vLines.length === 2) {
                  venue = vLines[0];
                  city = vLines[1];
              } else if (vLines.length === 3) {
                  venue = vLines[0];
                  city = vLines[1];
                  country = vLines[2];
              } else if (vLines.length >= 4) {
                  venue = vLines[0];
                  city = vLines[2];
                  country = vLines[3];
              }
          }
      }

      if (city) {
         city = city.replace(/^[\d\-\s]+/, '').trim();
         if (city.endsWith(" A")) city = city.substring(0, city.length - 2).trim();
         if (city.includes("@") || city.includes("&") || city.length > 30) city = "";
      }
      
      if (country) {
         country = country.replace(/,/g, "").trim(); 
         if (country.length === 2 && country === country.toUpperCase()) {
            if (COUNTRY_MAP[country]) country = COUNTRY_MAP[country];
         }
         if (country.length > 20 || country === "A") country = "";
      }

      if (!city || city.length < 3) {
          events.push({ skipped: true, rawSummary, reason: `City missing or too short. Extracted City: '${city}'` });
          continue;
      }

      const mCap = description.match(rgxCap);
      let capacity = "";
      if (mCap) capacity = mCap[1]; 
      
      const mDoors = description.match(rgxDoors);
      let doors = "";
      if (mDoors) doors = mDoors[1];
      
      const mTime = description.match(rgxTime);
      let time = "";
      if (mTime) time = (mTime[1] || mTime[2]).trim();
      
      let stageTime = "";
      const mStage = description.match(rgxStageTimeDesc);
      if (mStage && mStage[1]) {
         stageTime = mStage[1].trim();
      }

      events.push({
        skipped: false, rawSummary, summary, date, dateStr, venue, city, country,
        description, capacity, doors, time, stageTime, artists
      });
    }
    return events;
  } catch (e) {
    if (isDebugVerbose) console.error("iCal Parse Error: " + e.toString());
    return [];
  }
}

function ensureFolderAndChecklist(formattedName, artistString) {
  try {
    const rootPath = "[Files]/[Light Design]/Keinemusik/1 - Shows";
    const baseFolder = createNestedFolder(rootPath);
    if (!baseFolder) throw new Error("Could not create/find root folder.");
    const safeName = formattedName.replace(/[/\:*\?"<>|]/g, '-').replace(/\\/g, '-');
    let showFolder;
    const folders = baseFolder.getFoldersByName(safeName);
    if (folders.hasNext()) {
      showFolder = folders.next();
    } else {
      showFolder = baseFolder.createFolder(safeName);
      ["1 - Venue details (UPLOAD HERE)", "2 - Light and Stage Design", "3 - Sound", "0 - Archive"].forEach(subName => {
         showFolder.createFolder(subName);
      });
    }
    let checklistId = "";
    let totalItems = 0;
    const files = showFolder.getFilesByType(MimeType.GOOGLE_SHEETS);
    if (files.hasNext()) {
      const file = files.next();
      checklistId = file.getId();
    } else {
      const tempSS = SpreadsheetApp.openById(CHECKLIST_TEMPLATE_ID);
      const sheets = tempSS.getSheets();
      let targetSheetName = "";
      const parts = artistString.split(',').map(s => s.trim().toLowerCase());
      const isKeinemusik = parts.some(p => p.includes("keinemusik"));
      if (isKeinemusik) {
         targetSheetName = "keinemusik";
      } else if (parts.length > 1) {
         targetSheetName = "duo";
      } else {
         const singleArtist = parts[0] || "";
         for (let s of sheets) {
           if (singleArtist.includes(s.getName().toLowerCase())) {
             targetSheetName = s.getName();
             break;
           }
         }
      }
      if (!targetSheetName) targetSheetName = sheets[0].getName();
      const sheetToCopy = tempSS.getSheetByName(targetSheetName) || sheets[0];
      const newSS = SpreadsheetApp.create("Checklist - " + safeName);
      const newFile = DriveApp.getFileById(newSS.getId());
      newFile.moveTo(showFolder);
      sheetToCopy.copyTo(newSS).setName("Checklist");
      const defaultSheet = newSS.getSheetByName("Sheet1");
      if (defaultSheet) newSS.deleteSheet(defaultSheet);
      checklistId = newSS.getId();
      const newSheet = newSS.getSheets()[0];
      totalItems = newSheet.getLastRow() - 1; 
      if (totalItems < 0) totalItems = 0;
    }
    let fileCount = countFilesRecursively(showFolder, checklistId);
    return {
      url: showFolder.getUrl(),
      checklistId: checklistId,
      checklistCount: `0,${totalItems}`, 
      fileCount: fileCount
    };
  } catch (e) {
    console.error("ERROR in ensureFolderAndChecklist: " + e.toString());
    return null; 
  }
}

function countFilesRecursively(folder, excludeId) {
  let count = 0;
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (f.getId() !== excludeId) count++;
  }
  const subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    count += countFilesRecursively(subfolders.next(), excludeId);
  }
  return count;
}

function createNestedFolder(path) {
  if (!path) return DriveApp.getRootFolder();
  try {
    const parts = path.split('/');
    let current = DriveApp.getRootFolder();
    for (let p of parts) {
      if(!p) continue;
      const it = current.getFoldersByName(p);
      current = it.hasNext() ? it.next() : current.createFolder(p);
    }
    return current;
  } catch (e) {
    console.error("Error creating path: " + path + " -> " + e.toString());
    throw e;
  }
}

function getChecklistItems(checklistId) {
  try {
    const ss = SpreadsheetApp.openById(checklistId);
    const sheet = ss.getSheets()[0];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return []; 
    const range = sheet.getRange(2, 1, lastRow - 1, 5);
    const values = range.getValues();
    const items = values.map((row, idx) => ({
      rowIndex: idx + 2, 
      checked: row[0] === true || row[0] === "true", 
      name: row[1],
      category: row[2],
      details: row[3],
      deadlineDays: parseInt(row[4]) || 0
    }));
    items.sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return b.deadlineDays - a.deadlineDays; 
    });
    return items;
  } catch (e) {
    console.error("getChecklistItems Error: " + e.toString());
    return { error: "Could not load checklist: " + e.toString() };
  }
}

function toggleChecklistItem(checklistId, rowIndex, isChecked, mainRowIndex, mainColIndex) {
  try {
    const ss = SpreadsheetApp.openById(checklistId);
    const sheet = ss.getSheets()[0];
    sheet.getRange(rowIndex, 1).setValue(isChecked);
    
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    const total = data.length;
    const checkedCount = data.filter(r => r[0] === true || r[0] === "true").length;
    
    const countStr = `${checkedCount},${total}`;
    
    const mainSS = SpreadsheetApp.getActiveSpreadsheet();
    const mainSheet = mainSS.getSheetByName(SHEET_NAME);
    mainSheet.getRange(mainRowIndex, mainColIndex).setValue(countStr);
    
    return { success: true, newCount: countStr };
  } catch (e) {
    console.error("toggleChecklistItem Error: " + e.toString());
    return { success: false, error: e.toString() };
  }
}