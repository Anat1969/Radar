# רדאר (RADAR-GH)

מעקב אישי אחרי נושאים בחדשות בעברית, עם תקציר יומי של Claude. גרסה משודרגת של פרויקט Lovable "RADAR AKTUALYA Connect".

כתובת: https://radar-aktualya.vercel.app (פרויקט Vercel radar-aktualya. מיזוג ל-main מעדכן אותה).

## החלטות קבועות של ענת
- בלי התחברות, בלי הרשאות משתמש ובלי אישורים. כל מי שפותח את האפליקציה יכול לערוך.
- הנתונים בפרויקט Supabase בשם cultura-GH (ktqmwpbzcnzkhjskqisy). הפרויקט משותף, ולכן כל טבלה מתחילה ב-radar_. אין תלות בפרויקט RADAR-AKTUALYA הישן או ב-Lovable Cloud.
- מיזוג ל-main אחרי בדיקה ירוקה, בלי לשאול. ענת אישרה מיזוג קבוע.
- עברית ו-RTL, בלי אייקונים. סרגל עליון קבוע בכל הדפים, ושם האפליקציה מקשר לדף הבית.
- כפתורי המערכת ("העתקת קישור", "שיחת הפיתוח", "התקנת האפליקציה") מרוכזים בכפתור הלוגו A&I "אד׳ ענת שטיבלמן" בקצה הסרגל (`<ai-menu>`).

## מבנה
- `src/`: Vite, React ו-framer-motion. הדפים הם רדאר (/), נושא (/topic/:id?tab=), תדריך (/briefing?i=), ארכיון (/archive?topic=&date=), שמורות ונושאים והגדרות.
- `supabase/functions/radar-scan`: מושך Google News RSS בעברית (בלי מפתח), ו-Claude (`ANTHROPIC_API_KEY`, `claude-sonnet-5-5`) מסמן רלוונטיות וכותב את התקציר. יש הגבלה: סריקה אחת לנושא כל 5 דקות, ועד 60 סריקות בשעה.
- pg_cron `radar-auto-scan` רץ כל שעה, והפונקציה סורקת רק בשעה שנקבעה ב-radar_settings.scan_hour (שעון ישראל).
- `supabase/migrations/`: הסכמה. היא הוחלה דרך כלי ה-MCP.

## בדיקה
- `npm run build && npm test`: Playwright מול vite preview, עם מוקים ל-Supabase. הבדיקה לוחצת על כל כפתור, בודקת גלילה אופקית בנייד ואת יכולת ההתקנה.

## מלכודות
- Google News מחזיר הרבה כתבות לא קשורות (מילים מתפריטים ומתגיות באתר). לכן Claude מסמן `relevant` והממשק מסנן `relevant === false`.
- בכלי ה-SQL של ה-MCP, פקודות UPDATE ו-DELETE נתקעות עד שענת מאשרת. שינויי נתונים עוברים דרך פונקציית ה-Edge או דרך הממשק.

## A&I logo button
The top bar holds only the app name (links home), content navigation, and ONE logo button "אד' ענת שטיבלמן A&I" (`<ai-menu>` from https://appofapp-gh.vercel.app/ai-menu.js). Every editing and development action (העתקת קישור, שיחת הפיתוח, פרויקט המחקר, התקנת האפליקציה, edit mode, add, delete) lives only inside it, never as loose buttons. Standard: https://github.com/Anat1969/AppOfApp-GH/blob/main/docs/ai-menu-standard.md
