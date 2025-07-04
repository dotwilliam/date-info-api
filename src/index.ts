// src/index.ts — full compile‑ready Worker (2025‑07‑03)
// ====================================================
// Cloudflare Worker that returns an alphabetised, feature‑rich
// date‑info JSON payload.

export interface Env {}

const msDay = 86_400_000;        // milliseconds in a day

/*─────────── ordinals ───────────*/
function ord(n: number): string {
  const s = ["th", "st", "nd", "rd"] as const;
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
function ordWord(n: number): string {
  const ones  = ["","First","Second","Third","Fourth","Fifth","Sixth","Seventh","Eighth","Ninth"];
  const teens = ["Tenth","Eleventh","Twelfth","Thirteenth","Fourteenth","Fifteenth","Sixteenth","Seventeenth","Eighteenth","Nineteenth"];
  const tens  = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const two = (k:number):string =>
    k < 10 ? ones[k]
    : k < 20 ? teens[k-10]
    : `${tens[Math.floor(k/10)]}${k%10 ? "-"+ones[k%10].toLowerCase() : "ieth"}`;
  if (n <= 0 || n > 366) return "";
  if (n < 100) return two(n);
  const h   = Math.floor(n/100);
  const rem = n % 100;
  const base = ["","One","Two","Three"][h] + " Hundred";
  return rem ? `${base} ${two(rem).toLowerCase()}` : `${base}th`;
}

/*─────────── weekday helpers ───────────*/
const countWeekdaysInclusive = (from:number, to:number) => {
  let c=0;
  for(let t=from; t<=to; t+=msDay){
    const w=new Date(t).getUTCDay();
    if(w>=1 && w<=5) c++;
  }
  return c;
};
const totalWeekdays = (from:number,to:number)=>
  countWeekdaysInclusive(from,to-msDay);
const countWeekdayInRange = (start:number,end:number,wd:number)=>{
  let c=0;
  for(let t=start;t<end;t+=7*msDay){
    const d=new Date(t);
    d.setUTCDate(d.getUTCDate()+((wd-d.getUTCDay()+7)%7));
    if(+d<end) c++;
  }
  return c;
};

/*─────────── moon phase (8‑phase) ───────────*/
function moonPhaseUTC(dateUTC:number):string{
  const ref = Date.UTC(2000,0,6,18,14);          // reference new moon
  const age = ((dateUTC - ref) / msDay) % 29.53059;
  const phase = Math.floor(((age + 29.53059) % 29.53059) / 3.691323);
  return [
    "New Moon","Waxing Crescent","First Quarter","Waxing Gibbous",
    "Full Moon","Waning Gibbous","Last Quarter","Waning Crescent"
  ][phase];
}

/*─────────── derive() – builds mega‑payload ───────────*/
function derive(date: Date, tz: string) {
  /* anchors (UTC) */
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const weekday = date.getUTCDay();
  const dateUTC = Date.UTC(y, m, d);

  const startOfYear    = Date.UTC(y, 0, 1);
  const endOfYear      = Date.UTC(y + 1, 0, 1);
  const startOfQuarter = Date.UTC(y, Math.floor(m/3)*3, 1);
  const endOfQuarter   = Date.UTC(y, Math.floor(m/3)*3 + 3, 1);
  const startOfMonth   = Date.UTC(y, m, 1);
  const endOfMonth     = Date.UTC(y, m + 1, 1);
  const startOfWeekSun = Date.UTC(y, m, d - weekday);

  /* fiscal (Dec‑01 start) */
  const fyStartYear         = m >= 11 ? y : y - 1;
  const startOfFiscalYear   = Date.UTC(fyStartYear, 11, 1);
  const endOfFiscalYear     = Date.UTC(fyStartYear + 1, 11, 1);
  const fiscalMonthIndex    = (m + 1) % 12;          // 0 = Dec … 11 = Nov
  const fiscalQuarter       = Math.floor(fiscalMonthIndex / 3) + 1;
  const startOfFiscalQuarter = (() => {
    const abs = 11 + (fiscalQuarter - 1) * 3;
    return Date.UTC(fyStartYear + Math.floor(abs / 12), abs % 12, 1);
  })();
  const endOfFiscalQuarter = fiscalQuarter === 4 ? endOfFiscalYear
    : Date.UTC(fyStartYear + (fiscalQuarter >= 3 ? 1 : 0), ((fiscalQuarter % 4) * 3 + 11) % 12, 1);

  /* payload */
  const payload = {
    calWeekNumber: Math.floor((startOfWeekSun - startOfYear) / (7*msDay)) + 1,
    clearTimeLocal: `${new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(date)}T00:00:00`,
    clearTimeUTC: new Date(Date.UTC(y, m, d)).toISOString().replace(/\.\d{3}Z$/, "Z"),
    dayOfFiscalQuarter: Math.floor((dateUTC - startOfFiscalQuarter) / msDay) + 1,
    dayOfFiscalYear: Math.floor((dateUTC - startOfFiscalYear) / msDay) + 1,
    dayOfMonth: d,
    dayOfMonthNum: ordWord(d),
    dayOfMonthOrd: ord(d),
    dayOfQuarter: Math.floor((dateUTC - startOfQuarter) / msDay) + 1,
    dayOfQuarterNum: ordWord(Math.floor((dateUTC - startOfQuarter) / msDay) + 1),
    dayOfQuarterOrd: ord(Math.floor((dateUTC - startOfQuarter) / msDay) + 1),
    dayOfWeek: weekday,
    dayOfYear: Math.floor((dateUTC - startOfYear) / msDay) + 1,
    dayOfYearNum: ordWord(Math.floor((dateUTC - startOfYear) / msDay) + 1),
    dayOfYearOrd: ord(Math.floor((dateUTC - startOfYear) / msDay) + 1),
    daysRemainingFiscalQuarter: Math.floor((endOfFiscalQuarter - dateUTC) / msDay),
    daysRemainingFiscalYear: Math.floor((endOfFiscalYear - dateUTC) / msDay),
    daysRemainingMonth: Math.floor((endOfMonth - dateUTC) / msDay),
    daysRemainingQuarter: Math.floor((endOfQuarter - dateUTC) / msDay),
    daysRemainingWeek: 6 - weekday,
    daysRemainingYear: Math.floor((endOfYear - dateUTC) / msDay),
    fiscalQuarter,
    fiscalWeekNumber: Math.floor((startOfWeekSun - startOfFiscalYear) / (7*msDay)) + 1,
    fiscalYear: fyStartYear + 1,
    iso: date.toISOString(),
    isoOrdinal: `${y}-${String(Math.floor((dateUTC - startOfYear)/msDay)+1).padStart(3,"0")}`,
    isoWeekNumber: (() => {
      const thu = new Date(startOfWeekSun + 4*msDay);
      const isoYearStart = Date.UTC(thu.getUTCFullYear(), 0, 4);
      const isoWeek1Start = Date.UTC(thu.getUTCFullYear(), 0, 4 - ((new Date(isoYearStart).getUTCDay()+6)%7));
      return Math.floor((startOfWeekSun - isoWeek1Start) / (7*msDay)) + 1;
    })(),
    isHolidayUS: false,
    isLeapYear: (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0,
    isWeekday: weekday >= 1 && weekday <= 5,
    isWeekend: weekday === 0 || weekday === 6,
    longDateUTC: date.toUTCString(),
    longDayName: new Intl.DateTimeFormat("en-US", { weekday:"long", timeZone:"UTC" }).format(date),
    longMonthName: new Intl.DateTimeFormat("en-US", { month:"long",  timeZone:"UTC" }).format(date),
    longYear: y,
    milTime: new Intl.DateTimeFormat("en-GB",{hourCycle:"h23",hour:"2-digit",minute:"2-digit",timeZone:tz}).format(date),
    moonPhase: moonPhaseUTC(dateUTC),
    sameDaysInMonth: countWeekdayInRange(startOfMonth, endOfMonth, weekday),
    sameDaysInQuarter: countWeekdayInRange(startOfQuarter, endOfQuarter, weekday),
    sameDaysInYear: countWeekdayInRange(startOfYear, endOfYear, weekday),
    totalWeekdaysInMonth: totalWeekdays(startOfMonth, endOfMonth),
    totalWeekdaysInQuarter: totalWeekdays(startOfQuarter, endOfQuarter),
    totalWeekdaysInYear: totalWeekdays(startOfYear, endOfYear),
    tz,
    utcOffsetMinutes: -date.getTimezoneOffset(),
    weekdayName: new Intl.DateTimeFormat("en-US", { weekday:"long", timeZone: tz }).format(date),
    weekdayNameShort: new Intl.DateTimeFormat("en-US", { weekday:"short", timeZone: tz }).format(date),
    weekdayNameMin: new Intl.DateTimeFormat("en-US", { weekday:"narrow", timeZone: tz }).format(date),
    weekNumber: Math.floor((startOfWeekSun - startOfYear) / (7*msDay)) + 1,
    year: y,
  };

  return Object.fromEntries(
    Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))
  );
}


export default {
  async fetch(request: Request): Promise<Response> {
    const { searchParams } = new URL(request.url);

    const param = searchParams.get("date");
    const tz    = searchParams.get("tz") || "UTC";

    const date  = param ? new Date(param) : new Date();
    if (isNaN(date.getTime())) {
      return new Response(
        JSON.stringify({ error: "Invalid date." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = derive(date, tz);
    return new Response(
      JSON.stringify(result, null, 2),
      { headers: { "Content-Type": "application/json" } }
    );
  }
};
