/**
 * FaceAttend Chat Interface — Professional, Mobile-First Chat System
 * Standalone chat page handler with premium UI/UX
 */

const FACULTY_PERMISSION_PRESETS = {
  late_arrival: {
    label: 'Late Arrival',
    icon: 'fa-clock',
    category: 'Attendance adjustment',
    description: 'Covers a late login without making the whole day look off.',
    hint: 'Admin can regularize the punch and keep the day present instead of treating it as absent.',
    effect: 'Your attendance for that day will be corrected to show a valid check-in despite the late punch.',
    overrides: 'Overrides the Late Mark flag — the attendance record stays clean once approved.',
    defaultFullDay: false,
    showTimeRange: true,
    defaultStartTime: '09:30',
    defaultEndTime: '10:30',
    requestLabel: 'Partial day',
    evidence: 'Transport delay proof, medical visit slip, official meeting record'
  },
  early_departure: {
    label: 'Early Leave',
    icon: 'fa-arrow-right-from-bracket',
    category: 'Attendance adjustment',
    description: 'Records an early exit but keeps the attendance review clean.',
    hint: 'Useful for appointments, family needs, or duty outside campus after the session.',
    effect: 'The attendance record will show a valid partial-day entry with an early check-out approved by admin.',
    overrides: 'Overrides the incomplete check-out flag without affecting your morning attendance.',
    defaultFullDay: false,
    showTimeRange: true,
    defaultStartTime: '14:00',
    defaultEndTime: '16:10',
    requestLabel: 'Partial day',
    evidence: 'Medical slips, duty note, approved event schedule'
  },
  half_day_morning: {
    label: 'Half Day (Morning)',
    icon: 'fa-circle-half-stroke',
    category: 'Attendance adjustment',
    description: 'Waives the morning attendance requirement.',
    hint: 'Best for leave where the morning session is waived, but afternoon attendance is required.',
    effect: 'Attendance will be adjusted to show half-day presence, keeping the other half as a leave.',
    overrides: 'Overrides the morning absence mark with a half-day present record.',
    defaultFullDay: false,
    showTimeRange: true,
    defaultStartTime: '09:00',
    defaultEndTime: '13:00',
    requestLabel: 'Morning session',
    evidence: 'Appointment proof, duty slip, emergency note'
  },
  half_day_afternoon: {
    label: 'Half Day (Afternoon)',
    icon: 'fa-circle-half-stroke',
    category: 'Attendance adjustment',
    description: 'Waives the afternoon attendance requirement.',
    hint: 'Best for leave where the morning was attended, but afternoon session is waived.',
    effect: 'Attendance will be adjusted to show half-day presence, keeping the other half as a leave.',
    overrides: 'Overrides the afternoon/evening absence mark with a half-day present record.',
    defaultFullDay: false,
    showTimeRange: true,
    defaultStartTime: '13:00',
    defaultEndTime: '17:00',
    requestLabel: 'Afternoon session',
    evidence: 'Appointment proof, duty slip, emergency note'
  },
  extended_campus_exit: {
    label: 'Extended Campus Exit',
    icon: 'fa-person-walking-arrow-right',
    category: 'Attendance adjustment',
    description: 'Allows you to remain outside the campus after the lunch-return deadline for a limited approved duration.',
    hint: 'Best for temporary external duties, meetings, or bank visits without losing attendance.',
    effect: 'The outside-campus restriction is suspended until the approved deadline.',
    overrides: 'Overrides the Geofence restriction ONLY during the specified interval.',
    defaultFullDay: false,
    showTimeRange: true,
    defaultStartTime: '13:40',
    defaultEndTime: '15:15',
    requestLabel: 'Temporary exit',
    evidence: 'University work letter, duty order, medical note'
  },
  full_day_absence: {
    label: 'Full Day Leave',
    icon: 'fa-calendar-day',
    category: 'Leave',
    description: 'A clean full-day leave request for planned or approved absence.',
    hint: 'Use this when the full day should be treated as approved leave, not an unexcused absent.',
    effect: 'The absent mark will be converted to approved leave — no attendance penalty applied.',
    overrides: 'Overrides the Absent status with Approved Leave, which is preserved in reports.',
    defaultFullDay: true,
    showTimeRange: false,
    requestLabel: 'Full day',
    evidence: 'Medical document, principal approval letter, official leave form'
  },
  work_from_home: {
    label: 'Work From Home',
    icon: 'fa-house-laptop',
    category: 'Location / duty',
    description: 'Lets attendance be approved even when you are physically off campus.',
    hint: 'Admin can waive the GPS campus-radius check while keeping the day fully traceable.',
    effect: 'Your attendance will be marked Present for the day with a Remote Work note attached.',
    overrides: 'Overrides the GPS boundary violation — no Outside Campus Bounds penalty if approved.',
    defaultFullDay: true,
    showTimeRange: false,
    requestLabel: 'Remote day',
    evidence: 'Department approval email, remote-duty confirmation note'
  },
  outdoor_duty: {
    label: 'Outdoor Duty',
    icon: 'fa-location-dot',
    category: 'Location / duty',
    description: 'For field work, inspections, travel, or officially assigned outside work.',
    hint: 'Keeps the day linked to an official duty record instead of showing as a plain absence.',
    effect: 'The day is marked as On Duty in attendance records — no absent tag applied.',
    overrides: 'Overrides the location-miss and absent flag. GPS check is waived for that day.',
    defaultFullDay: true,
    showTimeRange: false,
    requestLabel: 'Field duty',
    evidence: 'Official duty order, travel or trip note, inspection schedule'
  },
  exam_duty: {
    label: 'Exam Duty',
    icon: 'fa-clipboard-check',
    category: 'Location / duty',
    description: 'Use when exam supervision or invigilation work changes your normal schedule.',
    hint: 'Admin can approve exam duty attendance without requiring a face scan or manual re-entry.',
    effect: 'Attendance is marked as Exam Duty Present — counts toward your duty record for the period.',
    overrides: 'Overrides the check-in requirement for that day. Scan and GPS checks are waived once approved.',
    defaultFullDay: true,
    showTimeRange: false,
    requestLabel: 'Duty day',
    evidence: 'Exam duty roster, official invigilation order from the controller'
  },
  on_duty: {
    label: 'On Duty',
    icon: 'fa-briefcase',
    category: 'Location / duty',
    description: 'For conferences, workshops, placement drives, sports events, and official outstation work.',
    hint: 'Shows the day as duty-backed attendance, not plain leave — keeps your record clean.',
    effect: 'Attendance is converted to On Duty status for that date, not counted as absent or leave.',
    overrides: 'Overrides absent and late flags. Attendance is replaced by an official duty entry.',
    defaultFullDay: true,
    showTimeRange: false,
    requestLabel: 'Duty day',
    evidence: 'Official duty order, event circular, assignment confirmation note'
  },
  forgot_check_in: {
    label: 'Forgot Check-in',
    icon: 'fa-right-to-bracket',
    category: 'System / proof',
    description: 'Regularizes a missed punch-in when you were actually physically present on campus.',
    hint: 'Best when the face scan simply did not happen but attendance should still be recorded.',
    effect: 'A manual check-in time is added to your record for that day — attendance is corrected.',
    overrides: 'Overrides the No Check-in flag. The absent or incomplete mark is removed once admin approves.',
    defaultFullDay: false,
    showTimeRange: false,
    requestLabel: 'Manual fix',
    evidence: 'Class register, CCTV note, colleague confirmation, or manual verification'
  },
  forgot_checkout: {
    label: 'Forgot Checkout',
    icon: 'fa-right-from-bracket',
    category: 'System / proof',
    description: 'Regularizes a missed punch-out after the rest of the day is otherwise valid.',
    hint: 'Use when check-in happened successfully but the check-out scan was skipped.',
    effect: 'A manual check-out is added to complete the attendance record for that day.',
    overrides: 'Overrides the incomplete session flag — the day will show as fully present once approved.',
    defaultFullDay: false,
    showTimeRange: false,
    requestLabel: 'Manual fix',
    evidence: 'Duty sheet, attendance log note, or admin confirmation'
  },
  device_problem: {
    label: 'Device Problem',
    icon: 'fa-mobile-screen-button',
    category: 'System / proof',
    description: 'For scanner, app, or hardware errors that prevented a normal attendance mark.',
    hint: 'Helps the admin regularize the day as a genuine technical failure, not a deliberate absence.',
    effect: 'Attendance is corrected to reflect your presence despite the device failure.',
    overrides: 'Overrides the technical miss — the absent/incomplete flag is cleared once admin approves.',
    defaultFullDay: false,
    showTimeRange: false,
    requestLabel: 'Technical issue',
    evidence: 'Screenshot of error, crash log, device incident report'
  },
  gps_failure: {
    label: 'GPS Failure',
    icon: 'fa-satellite-dish',
    category: 'System / proof',
    description: 'Used when the location service is not providing a reliable or accurate result.',
    hint: 'Can relax campus boundary enforcement for that day if the admin accepts the proof.',
    effect: 'The GPS boundary violation is waived — attendance is accepted as valid despite the location issue.',
    overrides: 'Overrides the Outside Campus Bounds flag. Location check is bypassed for that day.',
    defaultFullDay: false,
    showTimeRange: false,
    requestLabel: 'Location issue',
    evidence: 'GPS settings screenshot, device location log, network environment proof'
  },
  face_failure: {
    label: 'Face Recognition Failure',
    icon: 'fa-user-slash',
    category: 'System / proof',
    description: 'For genuine face-match problems that occurred during attendance marking.',
    hint: 'Lets admin manually review and confirm attendance instead of treating it as a missed mark.',
    effect: 'Attendance is manually confirmed for that day — recognition failure is noted and corrected.',
    overrides: 'Overrides the Face Not Detected or No Match flag. Admin manually validates the entry.',
    defaultFullDay: false,
    showTimeRange: false,
    requestLabel: 'Recognition issue',
    evidence: 'Scan failure screenshot, retry attempt log, admin manual review'
  },
  internet_failure: {
    label: 'Internet Failure',
    icon: 'fa-wifi',
    category: 'System / proof',
    description: 'For network loss events that prevented the attendance mark from syncing to the server.',
    hint: 'Useful when the scan happened locally but could not be delivered due to connectivity drop.',
    effect: 'Attendance is retroactively synced and marked as present for that day.',
    overrides: 'Overrides the sync failure — the offline scan is accepted and attendance is corrected.',
    defaultFullDay: false,
    showTimeRange: false,
    requestLabel: 'Connectivity issue',
    evidence: 'Network status screenshot, app error message, ISP downtime record'
  },
  emergency: {
    label: 'Emergency',
    icon: 'fa-triangle-exclamation',
    category: 'Special review',
    description: 'Fast-track request for urgent situations that genuinely require direct admin judgment.',
    hint: 'Use when normal rules simply do not cover the day and a manual decision is absolutely needed.',
    effect: 'Admin reviews and decides the attendance outcome manually — ensures no unfair penalty.',
    overrides: 'Can override any attendance flag including Absent, Late, GPS, and Face miss based on the emergency.',
    defaultFullDay: true,
    showTimeRange: false,
    requestLabel: 'Urgent review',
    evidence: 'Hospital or medical proof, emergency statement, any available follow-up document'
  },
  custom: {
    label: 'Custom Request',
    icon: 'fa-sliders',
    category: 'Special review',
    description: 'Build a fully custom exception case that does not fit any existing preset category.',
    hint: 'Tell the admin exactly what rule should be relaxed, for how long, and why.',
    effect: 'Admin evaluates your specific case and adjusts attendance accordingly if approved.',
    overrides: 'The exact attendance rule that gets overridden depends entirely on the admin decision.',
    defaultFullDay: false,
    showTimeRange: false,
    requestLabel: 'Custom scope',
    evidence: 'Any document, note, or proof that best clarifies your specific exception'
  }
};

const FACULTY_PERMISSION_SECTIONS = [
  {
    title: 'Attendance adjustments',
    description: 'Small rule relaxations that still keep the day structured.',
    types: ['late_arrival', 'early_departure', 'extended_campus_exit', 'half_day_morning', 'half_day_afternoon']
  },
  {
    title: 'Leave and duty',
    description: 'Approved leave, remote work, or official duty outside normal bounds.',
    types: ['full_day_absence', 'work_from_home', 'outdoor_duty', 'exam_duty', 'on_duty']
  },
  {
    title: 'Technical and special cases',
    description: 'When a tool, network, or recognition issue gets in the way.',
    types: ['forgot_check_in', 'forgot_checkout', 'device_problem', 'gps_failure', 'face_failure', 'internet_failure', 'emergency', 'custom']
  }
];

const ASSISTANT_KNOWLEDGE_BASE = [
  {
    key: 'getting_started',
    title: 'Getting started',
    description: 'Login, registration, roles, and first-time setup.',
    accent: 'blue',
    keywords: ['login', 'sign in', 'register', 'registration', 'password', 'role', 'dashboard', 'setup', 'first time'],
    topics: [
      {
        title: 'How do I log in?',
        keywords: ['login', 'log in', 'sign in', 'signin'],
        answer: `Open the login page, choose Login, and enter the Employee ID and password assigned to that account. After the first successful sign-in, the user moves into the dashboard and can continue with face setup or normal attendance flows.`
      },
      {
        title: 'How does faculty registration work?',
        keywords: ['register', 'registration', 'faculty register', 'self registration'],
        answer: `Faculty self-registration is available from the login page, but admin registration is the official path for staff onboarding. In the admin flow, the admin enters any faculty ID, full name, and password, then the faculty logs in and finishes the face setup step.`
      },
      {
        title: 'What happens after first login?',
        keywords: ['first login', 'first time', 'face setup', 'capture face'],
        answer: `The first login is where the system links the user to face attendance. The app expects the user to capture a clear face image so later scans can match them reliably during attendance marking.`
      },
      {
        title: 'Who can create accounts?',
        keywords: ['who can register', 'admin create', 'create account', 'add user'],
        answer: `Admins create faculty accounts from the dashboard, while faculty can use the self-registration path only when the college has enabled that workflow. The system keeps the role separation clear so the staff directory and approvals stay consistent.`
      }
    ]
  },
  {
    key: 'attendance_scan',
    title: 'Attendance and face scan',
    description: 'Check-in, recognition, location checks, and missed punches.',
    accent: 'indigo',
    keywords: ['attendance', 'check in', 'check-in', 'scan', 'face', 'camera', 'location', 'gps', 'late', 'checkout', 'check out'],
    topics: [
      {
        title: 'How do I check in?',
        keywords: ['check in', 'check-in', 'scan', 'attendance'],
        answer: `Open the scan page, allow camera and location access, and hold the face steady for recognition. The app uses the face detection and recognition models in the project to confirm identity and then marks attendance when the rule checks pass.`
      },
      {
        title: 'Why does face recognition matter?',
        keywords: ['face', 'recognition', 'biometric', 'camera'],
        answer: `Face recognition is the verification layer that stops someone from marking attendance for another person. The app first detects a face, then compares it against the stored facial profile, and only then treats the mark as valid.`
      },
      {
        title: 'What if I am late?',
        keywords: ['late', 'late arrival', 'late policy', 'late check in'],
        answer: `Late arrivals are not handled by a random rule; they are tracked as a policy case that can be regularized or approved by an admin. The assistant can explain the late policy, and the permissions flow lets the user submit a clean request instead of losing context.`
      },
      {
        title: 'What if I forget checkout?',
        keywords: ['forgot checkout', 'forgot check out', 'missed checkout'],
        answer: `If the check-out was missed, the record can be corrected through the exception workflow or by admin review. The goal is to preserve the real workday instead of turning a small scanning miss into a false absence.`
      }
    ]
  },
  {
    key: 'permissions_leave',
    title: 'Leave and permissions',
    description: 'Leave, duty, custom exceptions, and approvals.',
    accent: 'emerald',
    keywords: ['leave', 'permission', 'approval', 'duty', 'work from home', 'wfh', 'outdoor', 'exam', 'custom', 'proof', 'attachment'],
    topics: [
      {
        title: 'How do I apply for leave?',
        keywords: ['leave', 'apply leave', 'submit leave'],
        answer: `Use the permission or leave flow, select the right reason, add the date or time range, and explain the case clearly. If proof is needed, attach the document so the admin can approve the request without asking for the details again.`
      },
      {
        title: 'What permission types are available?',
        keywords: ['permission types', 'work from home', 'outdoor duty', 'exam duty', 'custom request'],
        answer: `The project already supports late arrival, early leave, half day, full day leave, work from home, outdoor duty, exam duty, on duty, missed check-in or checkout, device problem, GPS failure, face failure, internet failure, emergency, and custom requests.`
      },
      {
        title: 'How does approval work?',
        keywords: ['approval', 'approved', 'rejected', 'admin review'],
        answer: `The faculty submits the request first, then the admin reviews it from the approval side and decides whether it becomes approved, rejected, or stays pending. That keeps attendance changes traceable instead of manually editing records without context.`
      },
      {
        title: 'Can I attach proof?',
        keywords: ['proof', 'attachment', 'document', 'upload'],
        answer: `Yes. The request flow accepts supporting files like PDF, DOC, DOCX, JPG, JPEG, and PNG, which makes it easier for the admin to validate the case before changing the attendance outcome.`
      }
    ]
  },
  {
    key: 'admin_staff',
    title: 'Admin and staff management',
    description: 'Faculty onboarding, staff directory, permissions, and actions.',
    accent: 'amber',
    keywords: ['admin', 'staff directory', 'manage staff', 'register faculty', 'faculty id', 'delete user', 'mark absent', 'permissions'],
    topics: [
      {
        title: 'How do I register a faculty member?',
        keywords: ['register faculty', 'add faculty', 'faculty id', 'new faculty'],
        answer: `Open the admin dashboard, click Register Faculty, and enter the faculty ID exactly as assigned, along with the full name and password. The registration modal then sends the record to the backend, after which the faculty can log in and capture their face.`
      },
      {
        title: 'How does the staff directory work?',
        keywords: ['staff directory', 'manage staff', 'directory'],
        answer: `The staff directory loads live records from the users API and shows avatar, staff ID, name, role, current status, and action controls. Search filters the rows instantly, so an admin can find a person by ID, name, or role without leaving the page.`
      },
      {
        title: 'What can admins do from the directory?',
        keywords: ['view logs', 'mark absent', 'delete', 'actions'],
        answer: `From the directory, admins can open a staff profile or attendance logs, mark a user as Didn't Mark for the day, and remove a staff record when needed. Those actions are meant to keep the directory useful for operations, not just display data.`
      },
      {
        title: 'How do admins handle permissions?',
        keywords: ['admin permissions', 'approve request', 'permission management'],
        answer: `Admins review permission requests, inspect the reason and evidence, and then decide the status that should shape attendance. This is where policy and real-world exceptions meet, so the app keeps the decision visible and auditable.`
      }
    ]
  },
  {
    key: 'reports',
    title: 'Reports and monitoring',
    description: 'Attendance history, summaries, and exception tracking.',
    accent: 'violet',
    keywords: ['reports', 'summary', 'stats', 'history', 'monthly', 'export', 'analysis', 'monitoring'],
    topics: [
      {
        title: 'Where do I see attendance statistics?',
        keywords: ['stats', 'statistics', 'attendance stats', 'summary'],
        answer: `Attendance statistics live in the dashboard and report views, where you can see present days, late marks, absences, and other patterns. The assistant can point out the most relevant part of the report depending on whether you are faculty or admin.`
      },
      {
        title: 'What do the reports show?',
        keywords: ['report', 'reports', 'history', 'monthly'],
        answer: `Reports combine daily attendance states, exception cases, and longer-term trends so the college can see what changed over time. That makes the system useful for monitoring, not just marking attendance one day at a time.`
      },
      {
        title: 'Can I review old records?',
        keywords: ['old record', 'history', 'previous', 'past attendance'],
        answer: `Yes. The app keeps history available through the report and dashboard flows, so an admin or faculty member can revisit older attendance records when a correction or explanation is needed.`
      },
      {
        title: 'How are exceptions tracked?',
        keywords: ['exception', 'late', 'permission', 'waiver'],
        answer: `Exceptions are tracked as explicit cases instead of being hidden inside a generic attendance number. That makes it much easier to understand why a day changed and who approved the final outcome.`
      }
    ]
  },
  {
    key: 'alerts_chat',
    title: 'Notifications and chat',
    description: 'Messages, alerts, broadcasts, and the assistant itself.',
    accent: 'sky',
    keywords: ['messages', 'alerts', 'broadcast', 'chat', 'assistant', 'notification', 'inbox'],
    topics: [
      {
        title: 'What is the Messages tab?',
        keywords: ['messages', 'chat', 'direct message'],
        answer: `Messages are direct conversation threads between users. The page lets you search conversations, open a person quickly, and keep the chat tied to the app’s attendance workflow rather than an outside messenger.`
      },
      {
        title: 'What is the Alerts tab?',
        keywords: ['alerts', 'alert', 'notice'],
        answer: `Alerts are pinned notices that stay visible until they are cleared or handled. They are useful for official messages because they can be prioritized and tracked separately from normal chats.`
      },
      {
        title: 'How do broadcasts work?',
        keywords: ['broadcast', 'send alert', 'announcement'],
        answer: `The admin can write one announcement and send it to multiple faculty members at once. The app also keeps a mirrored admin copy so the broadcast can be managed or removed later without losing accountability.`
      },
      {
        title: 'How do I use the AI assistant?',
        keywords: ['assistant', 'ai', 'help', 'how to use assistant'],
        answer: `The AI tab is the FaceAttend knowledge engine. You can click a topic or ask your own question, and it will answer from the app’s working model, then hand off to the real assistant bridge when that connection is available.`
      }
    ]
  },
  {
    key: 'troubleshooting_security',
    title: 'Troubleshooting and security',
    description: 'Camera, GPS, sync, passwords, privacy, and mobile behavior.',
    accent: 'slate',
    keywords: ['camera', 'gps', 'internet', 'sync', 'password', 'privacy', 'security', 'error', 'device', 'mobile'],
    topics: [
      {
        title: 'What if the camera is denied?',
        keywords: ['camera denied', 'camera permission', 'camera not working'],
        answer: `Enable camera permission in the browser or app settings, then reopen the scan page. The recognition flow cannot start until the camera stream is available, so permissions are the first thing to check.`
      },
      {
        title: 'What if GPS is failing?',
        keywords: ['gps failure', 'location issue', 'location not working'],
        answer: `Turn on location services, allow precise location, and stay inside the allowed campus radius. If the device still cannot provide a reliable location, the admin can review the case through the permission flow.`
      },
      {
        title: 'What if the internet is unstable?',
        keywords: ['internet failure', 'offline', 'sync', 'network'],
        answer: `If the network drops, the app may not be able to sync the scan or request immediately. Retry once connectivity returns so the attendance event or permission request can be delivered cleanly.`
      },
      {
        title: 'How secure is the app?',
        keywords: ['security', 'password', 'privacy', 'data'],
        answer: `The project keeps user state and role data separated from the working pages, and passwords still follow a strong rule set. As a practical habit, always log out on shared devices and avoid leaving the app open on a public screen.`
      }
    ]
  },
  {
    key: 'system_architecture',
    title: 'System architecture',
    description: 'Project structure, deployment, and mobile runtime.',
    accent: 'teal',
    keywords: ['capacitor', 'android', 'netlify', 'models', 'api', 'architecture', 'runtime', 'build', 'deployment'],
    topics: [
      {
        title: 'How is the app built?',
        keywords: ['built', 'architecture', 'capacitor', 'frontend', 'backend'],
        answer: `The app is a web-first FaceAttend project packaged with Capacitor for mobile use. The visible UI lives in the www folder, while the backend APIs handle login, users, alerts, permissions, and report data.`
      },
      {
        title: 'What powers face attendance?',
        keywords: ['face model', 'face recognition model', 'yunet', 'sface'],
        answer: `The scan flow uses the face detection and recognition models stored in data/models. That gives the app a real biometric pipeline instead of a simple button click, which is why the face step matters before the mark is accepted.`
      },
      {
        title: 'How does the mobile app work?',
        keywords: ['mobile', 'android', 'capacitor', 'webview'],
        answer: `The mobile build uses the same web UI and loads it through the Capacitor bridge, which keeps behavior consistent across browser and Android. That also means the app can share most of its logic while still integrating native features where needed.`
      },
      {
        title: 'Where is the assistant bridge headed?',
        keywords: ['real assistant', 'bridge', 'live assistant', 'future'],
        answer: `The real-assistant bridge is designed as an upgrade path: the UI can already collect the question, show a connecting state, and then route to a live service when one is plugged in later. For now, the assistant can still answer from the app’s knowledge base so the experience remains useful.`
      }
    ]
  }
];

class ChatInterface {
  constructor() {
    this.API = window.CONFIG?.API_URL || 
               (window.API_BASE_URL ? `${window.API_BASE_URL}/api` : null) || 
               'http://127.0.0.1:5000/api';
    this.API = this.API.replace(/\/$/, '');

    this.user = JSON.parse(localStorage.getItem('user') || 'null');
    this.isAdmin = this.user?.role === 'admin';
    
    this.conversations = {};
    this.currentChat = null;
    this.currentChatUser = null;
    this.currentChatUserRole = null;
    this.alerts = [];
    this.activeTab = 'messages';
    this.searchQuery = '';
    this.selectedAlertPriority = 'info';
    this.pollInterval = null;
    this.isMobileView = window.matchMedia('(max-width: 767px)').matches;
    this.headerMenuOpen = false;
    this.broadcastRecipients = [];
    this.broadcastSelectedRecipients = new Set();
    this.allUsers = [];
    this.userSearchCache = new Map();
    this.userSuggestionDebounce = null;
    this.userSuggestionAbortController = null;
    this.selectedUserForNewConversation = null;
    this.assistantConnectionState = 'local';
    this.assistantActiveCategory = ASSISTANT_KNOWLEDGE_BASE[0]?.key || 'getting_started';
    this.assistantConnectionTimer = null;
    this.pinnedConversations = new Set(JSON.parse(localStorage.getItem('pinnedChats') || '[]'));
    this.messageReactions = new Map();
    this.draftStorageKey = `faceAttendChatDrafts:${this.user?.user_id || 'guest'}`;
    this.messageDrafts = JSON.parse(localStorage.getItem(this.draftStorageKey) || '{}');
    this.permissionState = {
      type: '',
      date: '',
      reason: ''
    };
    
    this.setupReactiveLiveSupport();
    
    // Auth check
    if (!this.user) {
      this.showSessionExpired();
      return;
    }
    else this.init();
  }

  async init() {
    this.buildUI();
    this.bindGlobalListeners();
    await Promise.all([
      this.loadConversations(),
      this.loadAllUsers()
    ]);
    this.attachEventListeners();
    this.startPolling();
    
    const urlParams = new URLSearchParams(window.location.search);
    const targetTab = urlParams.get('tab') || 'messages';
    
    let subtitle = 'Messages';
    if (targetTab === 'alerts') subtitle = 'Alerts';
    if (targetTab === 'assistant') subtitle = 'Live Support';
    if (targetTab === 'broadcast') subtitle = 'Broadcast';

    this.updateHeaderSubtitle(subtitle);
    this.switchTab(targetTab);
  }

  bindGlobalListeners() {
    window.addEventListener('resize', () => {
      this.isMobileView = window.matchMedia('(max-width: 767px)').matches;
      if (!this.isMobileView) this.exitChatView(false);
    });

    window.addEventListener('beforeunload', () => {
      if (this.pollInterval) clearInterval(this.pollInterval);
    });

    window.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('searchInput')?.focus();
      }
    });
  }

  buildUI() {
    const isAdmin = this.isAdmin;
    const html = `
      <div class="chat-container">
        <!-- Mobile Header -->
        <div class="chat-header-mobile">
          <button class="btn-back" id="btnBack" title="Back">
            <i class="fas fa-chevron-left"></i>
          </button>
          <div class="header-title-section">
            <h1 class="header-title">FaceAttend Chat</h1>
            <p class="header-subtitle" id="headerSubtitle">Messages</p>
          </div>
          <button class="btn-menu" id="btnMenu" title="Menu">
            <i class="fas fa-ellipsis-v"></i>
          </button>
        </div>

        <!-- Main Container with Split View for Desktop -->
        <div class="chat-main">
          <!-- Conversations Panel -->
          <div class="conversations-panel" id="convPanel">
            <div class="workspace-heading">
              <div>
                <span class="workspace-eyebrow">FaceAttend</span>
                <h2>Messages Inbox</h2>
              </div>
              <div class="workspace-actions">
                <span class="workspace-count" id="workspaceCount">0 conversations</span>
              </div>
            </div>
            <!-- Tabs -->
            <div class="tabs-navigation">
              <button class="tab-btn active" data-tab="messages">
                <i class="fas fa-comment-dots"></i>
                <span>Messages</span>
              </button>
              <button class="tab-btn" data-tab="alerts">
                <i class="fas fa-bell"></i>
                <span>Alerts</span>
                <span class="tab-badge" id="alertBadge" style="display: none;">0</span>
              </button>
              <button class="tab-btn" data-tab="assistant">
                <i class="fas fa-sparkles"></i>
                <span>AI</span>
              </button>
              ${isAdmin ? `
                <button class="tab-btn" data-tab="broadcast">
                  <i class="fas fa-megaphone"></i>
                  <span>Broadcast</span>
                </button>
              ` : ''}
            </div>

            <!-- Search Bar -->
            <div class="search-container">
              <div class="search-input-wrapper">
                <i class="fas fa-search"></i>
                <input type="text" id="searchInput" placeholder="Search people, IDs, or recent context..." class="search-input">
              </div>
              <button class="btn-new-chat" id="btnNewChat" title="New message">
                <i class="fas fa-plus"></i>
              </button>
            </div>

            <!-- Conversations List -->
            <div class="conversations-list" id="convList">
              <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No conversations yet</p>
                <button class="btn-primary-sm" id="btnStartChat">Start Chatting</button>
              </div>
            </div>
          </div>

          <!-- Chat Area -->
          <div class="chat-area" id="chatArea">
            <div class="chat-empty">
              <div class="empty-state-icon">
                <i class="fas fa-layer-group"></i>
              </div>
              <span class="empty-kicker">Structured messaging</span>
              <h2>Pick a thread and run the day from one clean surface.</h2>
              <p>Messages, permission requests, alerts, and assistant support stay organized without leaving FaceAttend.</p>
              <button class="empty-new-chat" id="btnEmptyNewChat" type="button">Start a focused thread</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modals -->
      <div class="modal-overlay" id="modalOverlay"></div>
      
      <!-- New Message Modal -->
      <div class="modal" id="newMessageModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Start a conversation</h3>
            <button class="btn-close" onclick="chatInterface.hideAllModals()">&times;</button>
          </div>
          <div class="modal-body">
            <input type="text" id="userIdInput" placeholder="Enter user ID or name" class="input-field">
            <div class="suggestions" id="userSuggestions"></div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" onclick="chatInterface.hideAllModals()">Cancel</button>
            <button class="btn-primary" id="btnConfirmMessage">Send Message</button>
          </div>
        </div>
      </div>

      <!-- Permission Request Modal (Wizard) -->
      <div class="modal" id="permissionRequestModal">
        <div class="modal-content modal-large wizard-modal">
          <div class="modal-header wizard-header">
            <div>
              <h3>Raise Exception Proposal</h3>
              <div class="wizard-progress">
                <span class="wizard-step-dot active" id="dotStep1"></span>
                <span class="wizard-step-dot" id="dotStep2"></span>
                <span class="wizard-step-dot" id="dotStep3"></span>
              </div>
            </div>
            <button class="btn-close" onclick="chatInterface.hideAllModals()">&times;</button>
          </div>
          
          <div class="modal-body permission-form">
            <form id="permissionForm">
              <input type="hidden" id="permissionCategory" value="">
              <input type="hidden" id="permissionType" value="">
              
              <div class="wizard-container">
                
                <!-- STEP 1: Categories -->
                <div class="wizard-step active" id="wizardStep1">
                  <div class="permission-request-intro">
                    <span class="permission-eyebrow">Step 1 of 3</span>
                    <h4>What kind of exception do you need?</h4>
                    <p>Select the broad category that best fits your situation. We'll narrow down the exact type next.</p>
                  </div>
                  <div class="wizard-category-grid" id="wizardCategoryGrid">
                    <!-- Populated dynamically via renderWizardCategories() -->
                  </div>
                </div>

                <!-- STEP 2: Types -->
                <div class="wizard-step" id="wizardStep2">
                  <div class="permission-request-intro">
                    <span class="permission-eyebrow">Step 2 of 3</span>
                    <h4>Select the specific request type</h4>
                    <p>Choose the exact rule relaxation you are proposing.</p>
                  </div>
                  <div class="wizard-type-grid" id="wizardTypeGrid">
                    <!-- Populated dynamically via renderWizardTypes() -->
                  </div>
                </div>

                <!-- STEP 3: Form Details & Benefits -->
                <div class="wizard-step" id="wizardStep3">
                  <div class="permission-request-intro">
                    <span class="permission-eyebrow">Step 3 of 3</span>
                    <h4>Provide the details</h4>
                    <p>Complete your proposal for admin review.</p>
                  </div>

                  <!-- Benefit / Impact Callout -->
                  <div class="permission-benefit-card" id="permissionBenefitCard">
                    <div class="benefit-head">
                      <div class="benefit-icon"><i class="fas fa-magic"></i></div>
                      <div>
                        <span class="benefit-kicker">Expected Impact</span>
                        <strong id="benefitTitle">Benefit Name</strong>
                      </div>
                    </div>
                    <p id="benefitHint">Benefit explanation goes here.</p>
                    <div class="benefit-meta">
                      <span id="benefitScope"><i class="fas fa-clock"></i> Scope</span>
                      <span id="benefitEvidence"><i class="fas fa-file-shield"></i> Proof needed</span>
                    </div>
                  </div>

                  <div class="form-row mt-3">
                    <div class="form-group">
                      <label for="permissionDate">Date</label>
                      <input type="date" id="permissionDate" class="input-field" required>
                    </div>
                    <div class="form-group">
                      <label class="checkbox-label permission-full-day-toggle">
                        <input type="checkbox" id="permissionFullDay">
                        <span>Request for full day</span>
                      </label>
                    </div>
                  </div>

                  <div id="timeRangeGroup" style="display: none;">
                    <div class="form-row">
                      <div class="form-group">
                        <label for="startTime">Start Time</label>
                        <input type="time" id="startTime" class="input-field">
                      </div>
                      <div class="form-group">
                        <label for="endTime">End Time</label>
                        <input type="time" id="endTime" class="input-field">
                      </div>
                    </div>
                  </div>

                  <div class="form-group" id="customTypeGroup" style="display: none;">
                    <label for="customType">Custom request title</label>
                    <input type="text" id="customType" class="input-field" placeholder="e.g., Guest lecture duty, NAAC inspection">
                  </div>

                  <div class="form-group" id="customDaysGroup" style="display: none;">
                    <label for="customDaysCount">Consecutive days</label>
                    <input type="number" id="customDaysCount" class="input-field" min="1" max="31" value="1">
                    <small>The selected date is day 1. We will block out the next consecutive days.</small>
                  </div>

                  <div class="form-group">
                    <label for="permissionReason">Reason / Description</label>
                    <textarea id="permissionReason" class="input-field" rows="3" placeholder="Explain what happened and what should be relaxed..." required></textarea>
                  </div>

                  <div class="form-group">
                    <label for="permissionDocument">
                      <i class="fas fa-paperclip"></i> Attach Proof (optional)
                    </label>
                    <div class="file-upload-wrapper">
                      <input type="file" id="permissionDocument" class="input-field file-input" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png">
                      <span id="fileName" class="file-name"></span>
                    </div>
                    <small>PDF, DOC, JPG, PNG. Max 5MB.</small>
                  </div>
                </div>

              </div>
            </form>
          </div>
          
          <div class="modal-footer wizard-footer">
            <button type="button" class="btn-secondary" id="btnWizardBack" style="display: none;" onclick="chatInterface.wizardBack()">Back</button>
            <div style="flex: 1;"></div>
            <button type="button" class="btn-secondary" onclick="chatInterface.hideAllModals()">Cancel</button>
            <button type="button" class="btn-primary" id="btnWizardNext" style="display: none;" onclick="chatInterface.wizardNext()">Continue</button>
            <button type="button" class="btn-primary" id="btnSubmitPermission" style="display: none;">Submit Proposal</button>
          </div>
        </div>
      </div>

      <!-- Toast Notifications -->
      <div class="toast-container" id="toastContainer"></div>

      <!-- Header Menu -->
      <div class="header-menu" id="headerMenu">
        <button class="header-menu-item" id="menuRefresh">
          <i class="fas fa-rotate"></i>
          <span>Refresh</span>
        </button>
        <button class="header-menu-item" id="menuClearCurrent">
          <i class="fas fa-trash"></i>
          <span>Clear current chat</span>
        </button>
        <button class="header-menu-item" id="menuClose">
          <i class="fas fa-xmark"></i>
          <span>Close menu</span>
        </button>
      </div>
    `;
    
    document.body.innerHTML = html;
    document.getElementById('btnEmptyNewChat')?.addEventListener('click', () => this.showModal('newMessageModal'));
  }

  attachEventListeners() {
    // Back button
    document.getElementById('btnBack').addEventListener('click', () => this.handleBackAction());

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;
        this.switchTab(this.activeTab);
      });
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderConversations();
    });

    // New chat
    document.getElementById('btnNewChat').addEventListener('click', () => {
      this.showModal('newMessageModal');
    });

    document.getElementById('btnMenu').addEventListener('click', () => this.toggleHeaderMenu());

    const btnStartChat = document.getElementById('btnStartChat');
    if (btnStartChat) {
      btnStartChat.addEventListener('click', () => this.showModal('newMessageModal'));
    }

    // Modal overlay click
    document.getElementById('modalOverlay').addEventListener('click', () => {
      this.hideAllModals();
    });

    // Confirm new message
    document.getElementById('btnConfirmMessage').addEventListener('click', () => {
      const userId = document.getElementById('userIdInput').value.trim();
      if (userId) this.startConversation(userId);
    });

    // User Autocomplete
    const userIdInput = document.getElementById('userIdInput');
    if (userIdInput) {
      userIdInput.addEventListener('input', (e) => {
        this.queueUserSuggestionSearch(e.target.value);
      });
      
      // Hide suggestions when clicking outside
      document.addEventListener('click', (e) => {
        const suggestionsDiv = document.getElementById('userSuggestions');
        if (suggestionsDiv && !userIdInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
          suggestionsDiv.classList.remove('active');
        }
      });
    }

    const menuRefresh = document.getElementById('menuRefresh');
    const menuClearCurrent = document.getElementById('menuClearCurrent');
    const menuClose = document.getElementById('menuClose');

    if (menuRefresh) {
      menuRefresh.addEventListener('click', async () => {
        this.hideHeaderMenu();
        if (this.activeTab === 'alerts') await this.loadAlerts();
        else await this.loadConversations();
        this.showToast('Refreshed', 'success');
      });
    }

    if (menuClearCurrent) {
      menuClearCurrent.addEventListener('click', async () => {
        this.hideHeaderMenu();
        await this.clearCurrentConversation();
      });
    }

    if (menuClose) {
      menuClose.addEventListener('click', () => this.hideHeaderMenu());
    }

    document.addEventListener('click', (event) => {
      const menu = document.getElementById('headerMenu');
      const trigger = document.getElementById('btnMenu');
      if (!menu || !trigger || !this.headerMenuOpen) return;
      if (menu.contains(event.target) || trigger.contains(event.target)) return;
      this.hideHeaderMenu();
    });
  }

  async loadConversations() {
    try {
      const res = await fetch(`${this.API}/messages/${this.user.user_id}`);
      const data = await res.json();
      
      this.conversations = {};
      (data.messages || []).forEach(msg => {
        const otherId = msg.sender_id === this.user.user_id ? msg.recipient_id : msg.sender_id;
        const otherName = msg.sender_id === this.user.user_id ? (msg.recipient_name || otherId) : (msg.sender_name || otherId);
        const otherRole = msg.sender_id === this.user.user_id ? (msg.recipient_role || null) : (msg.sender_role || null);
        
        if (!this.conversations[otherId]) {
          this.conversations[otherId] = {
            id: otherId,
            name: otherName,
            role: otherRole,
            messages: [],
            unread: 0,
            lastMessage: null,
            lastTime: null
          };
        } else if (!this.conversations[otherId].role && otherRole) {
          this.conversations[otherId].role = otherRole;
        }
        
        this.conversations[otherId].messages.push(msg);
        if (msg.sender_id !== this.user.user_id && !msg.is_read) {
          this.conversations[otherId].unread++;
        }
        
        this.conversations[otherId].lastMessage = msg.content;
        this.conversations[otherId].lastTime = this.getMessageTimestamp(msg);
      });

      Object.values(this.conversations).forEach(conv => {
        conv.messages.sort((a, b) => this.getMessageDate(a) - this.getMessageDate(b));
        const lastMsg = conv.messages[conv.messages.length - 1];
        conv.lastMessage = lastMsg?.content || null;
        conv.lastTime = this.getMessageTimestamp(lastMsg);
      });

      this.conversations = Object.fromEntries(
        Object.values(this.conversations)
            .sort((a, b) => new Date(b.lastTime || 0) - new Date(a.lastTime || 0))
          .map(conv => [conv.id, conv])
      );

      this.renderConversations();
    } catch (err) {
      console.error('Failed to load conversations:', err);
      const list = document.getElementById('convList');
      if (list && !Object.keys(this.conversations).length) {
        list.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-plug-circle-xmark"></i>
            <p>Unable to load chats</p>
          </div>
        `;
      }
      this.showToast('Failed to load conversations', 'error');
    }
  }

  async loadAllUsers() {
    try {
      // Fallback list only (live search uses /users/search?q=...)
      const res = await fetch(`${this.API}/users/faculty`);
      if (!res.ok) throw new Error('Faculty list not available');
      const data = await res.json();
      this.allUsers = data.faculty || [];
    } catch (err) {
      console.warn('Failed to load users for autocomplete:', err);
      // Final fallback: use locally known conversations
      this.allUsers = Object.values(this.conversations).map(c => ({
        user_id: c.id,
        name: c.name,
        role: 'user'
      }));
    }
  }

  queueUserSuggestionSearch(query) {
    this.selectedUserForNewConversation = null;

    if (this.userSuggestionDebounce) {
      clearTimeout(this.userSuggestionDebounce);
      this.userSuggestionDebounce = null;
    }

    const normalized = String(query || '').trim();
    if (!normalized) {
      this.hideUserSuggestions();
      return;
    }

    this.userSuggestionDebounce = setTimeout(() => {
      this.updateUserSuggestions(normalized);
    }, 220);
  }

  hideUserSuggestions() {
    const suggestionsDiv = document.getElementById('userSuggestions');
    if (!suggestionsDiv) return;
    suggestionsDiv.classList.remove('active');
    suggestionsDiv.innerHTML = '';
  }

  showUserSuggestionsLoading() {
    const suggestionsDiv = document.getElementById('userSuggestions');
    if (!suggestionsDiv) return;
    suggestionsDiv.innerHTML = `
      <div class="suggestion-item">
        <span class="suggestion-id" style="text-align:center; padding: 4px 0;">Searching…</span>
      </div>
    `;
    suggestionsDiv.classList.add('active');
  }

  async updateUserSuggestions(query) {
    const suggestionsDiv = document.getElementById('userSuggestions');
    if (!suggestionsDiv) return;

    const normalizedLower = String(query || '').trim().toLowerCase();
    if (!normalizedLower) {
      this.hideUserSuggestions();
      return;
    }

    // Cache hit
    if (this.userSearchCache.has(normalizedLower)) {
      this.renderUserSuggestionsList(this.userSearchCache.get(normalizedLower), normalizedLower);
      return;
    }

    // Cancel any previous in-flight search
    if (this.userSuggestionAbortController) {
      this.userSuggestionAbortController.abort();
    }
    this.userSuggestionAbortController = new AbortController();

    this.showUserSuggestionsLoading();

    let users = [];
    try {
      const res = await fetch(`${this.API}/users/search?q=${encodeURIComponent(normalizedLower)}`, {
        signal: this.userSuggestionAbortController.signal
      });

      if (res.ok) {
        const data = await res.json();
        users = Array.isArray(data.users) ? data.users : [];
      }
    } catch (err) {
      // Ignore abort errors; fallback to local list for other errors
      if (err?.name !== 'AbortError') {
        console.warn('User search failed, falling back to cached list:', err);
      } else {
        return;
      }
    }

    // Fallback: local filter if API returned nothing
    if (!users.length) {
      users = (this.allUsers || []).filter(u =>
        String(u.user_id) !== String(this.user.user_id) &&
        (String(u.name || '').toLowerCase().includes(normalizedLower) ||
          String(u.user_id || '').toLowerCase().includes(normalizedLower))
      ).slice(0, 10);
    }

    // Exclude self and limit
    users = (users || []).filter(u => String(u.user_id) !== String(this.user.user_id)).slice(0, 10);
    this.userSearchCache.set(normalizedLower, users);
    this.renderUserSuggestionsList(users, normalizedLower);
  }

  renderUserSuggestionsList(users, queryLower) {
    const suggestionsDiv = document.getElementById('userSuggestions');
    if (!suggestionsDiv) return;

    const list = Array.isArray(users) ? users : [];

    if (!queryLower) {
      this.hideUserSuggestions();
      return;
    }

    if (!list.length) {
      suggestionsDiv.innerHTML = `
        <div class="suggestion-item">
          <span class="suggestion-id" style="text-align:center; padding: 4px 0;">No users found</span>
        </div>
      `;
      suggestionsDiv.classList.add('active');
      return;
    }

    suggestionsDiv.innerHTML = list.map(u => {
      const name = u.name || u.user_id;
      const role = u.role || 'user';
      return `
        <div class="suggestion-item" data-id="${this.escapeHtml(u.user_id)}" data-name="${this.escapeHtml(name)}" data-role="${this.escapeHtml(role)}">
          <span class="suggestion-name">${this.escapeHtml(name)}</span>
          <span class="suggestion-id">${this.escapeHtml(u.user_id)} • ${this.escapeHtml(role)}</span>
        </div>
      `;
    }).join('');

    suggestionsDiv.classList.add('active');

    suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const input = document.getElementById('userIdInput');
        if (!input) return;

        const selectedId = item.dataset.id;
        const selectedName = item.dataset.name;

        input.value = selectedId;
        input.focus();
        this.selectedUserForNewConversation = { user_id: selectedId, name: selectedName };
        suggestionsDiv.classList.remove('active');
      });
    });
  }

  togglePinConversation(userId) {
    if (this.pinnedConversations.has(userId)) {
      this.pinnedConversations.delete(userId);
      this.showToast('Conversation unpinned', 'success');
    } else {
      this.pinnedConversations.add(userId);
      this.showToast('Conversation pinned', 'success');
    }
    localStorage.setItem('pinnedChats', JSON.stringify([...this.pinnedConversations]));
    this.renderConversations();
  }

  getConversationPreview(conv) {
    const lastMessage = String(conv?.lastMessage || '').replace(/\s+/g, ' ').trim();
    if (!lastMessage) return 'No messages yet. Open the thread and start clean.';
    if (lastMessage.toLowerCase().startsWith('permission request')) return 'Permission request awaiting review';
    return lastMessage.substring(0, 90);
  }

  getConversationFreshness(timestamp) {
    if (!timestamp) return 'New thread';
    const then = this.parseTimestamp(timestamp);
    const diffMs = Date.now() - then.getTime();
    if (diffMs < 60 * 1000) return 'Just now';
    if (diffMs < 60 * 60 * 1000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / 3600000)}h ago`;
    return `${Math.floor(diffMs / 86400000)}d ago`;
  }

  getDisplayRole(role) {
    const normalized = String(role || 'member').toLowerCase();
    if (normalized === 'admin') return 'Admin';
    if (normalized === 'faculty') return 'Faculty';
    return 'Member';
  }

  getConversationStats(messages = []) {
    return messages.reduce((stats, msg) => {
      stats.total += 1;
      if (msg.sender_id === this.user.user_id) stats.sent += 1;
      else stats.received += 1;
      if ((msg.message_type || msg.type) === 'permission_request') stats.requests += 1;
      return stats;
    }, { total: 0, sent: 0, received: 0, requests: 0 });
  }

  saveDraftForCurrentChat(value) {
    if (!this.currentChat) return;
    const text = String(value || '');
    if (text.trim()) this.messageDrafts[this.currentChat] = text;
    else delete this.messageDrafts[this.currentChat];
    localStorage.setItem(this.draftStorageKey, JSON.stringify(this.messageDrafts));
    this.renderConversations();
  }

  getCommandTemplate(rawValue) {
    const value = String(rawValue || '').trim().toLowerCase();
    const templates = {
      '/late': 'I may arrive late today due to an unavoidable delay. I will update once I reach campus.',
      '/review': 'Please review this when you get a moment. I have added the necessary context above.',
      '/thanks': 'Thanks, noted. I will follow up shortly with the next update.',
      '/proof': 'I can share proof if required. Please let me know what document would be most useful.'
    };
    return templates[value] || null;
  }

  async copyMessageToClipboard(text) {
    const value = String(text || '');
    if (!value) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const temp = document.createElement('textarea');
        temp.value = value;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        temp.remove();
      }
      this.showToast('Message copied', 'success');
    } catch (err) {
      console.warn('Copy failed:', err);
      this.showToast('Could not copy message', 'error');
    }
  }

  renderConversations() {
    const list = document.getElementById('convList');
    let filtered = Object.values(this.conversations);

    if (this.searchQuery) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(this.searchQuery) ||
        c.id.toLowerCase().includes(this.searchQuery)
      );
    }

    const count = document.getElementById('workspaceCount');
    if (count) count.textContent = `${filtered.length} conversation${filtered.length === 1 ? '' : 's'}`;

    if (!filtered.length) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-search"></i>
          <p>${this.searchQuery ? 'No results found' : 'No conversations yet'}</p>
        </div>
      `;
      return;
    }

    filtered.sort((a, b) => {
      const aPinned = this.pinnedConversations.has(a.id);
      const bPinned = this.pinnedConversations.has(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return new Date(b.lastTime || 0) - new Date(a.lastTime || 0);
    });

    list.innerHTML = filtered.map(conv => {
      const isPinned = this.pinnedConversations.has(conv.id);
      const messages = conv.messages || [];
      const preview = this.getConversationPreview(conv);
      const role = this.getDisplayRole(conv.role);
      const draft = this.messageDrafts?.[conv.id];
      const metric = `${messages.length} msg${messages.length === 1 ? '' : 's'}`;
      return `
        <div class="conversation-item ${this.currentChat === conv.id ? 'active' : ''} ${isPinned ? 'pinned' : ''} ${conv.unread > 0 ? 'has-unread' : ''}" 
             data-user-id="${encodeURIComponent(conv.id)}"
             data-user-name="${encodeURIComponent(conv.name)}">
          <div class="conv-avatar" style="background: ${this.getColorForUser(conv.id)}">
            ${this.getInitials(conv.name)}
            <span class="status-dot online"></span>
          </div>
          <div class="conv-content">
            <div class="conv-header">
              <div class="conv-title-stack">
                <h4 class="conv-name">${this.escapeHtml(conv.name)}</h4>
                <span class="conv-role-chip">${this.escapeHtml(role)}</span>
              </div>
              <span class="conv-time">${this.formatTime(conv.lastTime)}</span>
            </div>
            <p class="conv-preview">
              ${draft ? `<span class="draft-prefix">Draft</span> ${this.escapeHtml(String(draft).substring(0, 70))}` : this.escapeHtml(preview)}
            </p>
            <div class="conv-meta-row">
              <span><i class="fas fa-wave-square"></i> ${this.escapeHtml(metric)}</span>
              <span><i class="fas fa-clock"></i> ${this.escapeHtml(this.getConversationFreshness(conv.lastTime))}</span>
              ${isPinned ? '<span class="pin-label"><i class="fas fa-thumbtack"></i> Pinned</span>' : ''}
            </div>
          </div>
          <div class="conv-actions">
            ${conv.unread > 0 ? `<span class="unread-badge">${conv.unread}</span>` : ''}
            <button class="conv-pin-btn" data-pin-user-id="${encodeURIComponent(conv.id)}" title="${isPinned ? 'Unpin' : 'Pin'}">
              <i class="fas fa-thumbtack"></i>
            </button>
            <button class="conv-clear-btn" data-clear-user-id="${encodeURIComponent(conv.id)}" data-clear-user-name="${encodeURIComponent(conv.name)}" title="Clear this chat">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => {
        const userId = decodeURIComponent(item.dataset.userId || '');
        const userName = decodeURIComponent(item.dataset.userName || userId);
        this.openConversation(userId, userName);
      });
    });

    list.querySelectorAll('.conv-pin-btn').forEach(btn => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const userId = decodeURIComponent(btn.dataset.pinUserId || '');
        if (userId) this.togglePinConversation(userId);
      });
    });

    list.querySelectorAll('.conv-clear-btn').forEach(btn => {
      btn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const userId = decodeURIComponent(btn.dataset.clearUserId || '');
        const userName = decodeURIComponent(btn.dataset.clearUserName || userId);
        await this.clearConversationById(userId, userName);
      });
    });
  }

  async openConversation(userId, userName) {
    if (this.currentChat !== userId) this.activeConversationQuery = '';
    this.currentChat = userId;
    this.currentChatUser = userName;
    this.currentChatUserRole = this.conversations[userId]?.role || this.currentChatUserRole || null;
    if (this.conversations[userId]) this.conversations[userId].unread = 0;
    await this.loadConversationMessages(userId, userName);
    this.currentChatUserRole = this.conversations[userId]?.role || this.currentChatUserRole || null;
    this.renderConversations();
    this.enterChatView();
  }

  async loadConversationMessages(userId, userName) {
    if (!this.conversations[userId]) {
      this.conversations[userId] = {
        id: userId,
        name: userName || userId,
        role: null,
        messages: [],
        unread: 0,
        lastMessage: null,
        lastTime: null
      };
    }

    try {
      const res = await fetch(`${this.API}/messages/${this.user.user_id}/with/${userId}`);
      const data = await res.json();
      const msgs = Array.isArray(data.messages) ? data.messages : [];

      this.conversations[userId].messages = msgs;
      if (!this.conversations[userId].role && msgs.length) {
        const firstMsg = msgs[0];
        const inferredRole = firstMsg?.sender_id === this.user.user_id ? firstMsg?.recipient_role : firstMsg?.sender_role;
        if (inferredRole) this.conversations[userId].role = inferredRole;
      }
      const last = msgs[msgs.length - 1];
      this.conversations[userId].lastMessage = last?.content || this.conversations[userId].lastMessage;
      this.conversations[userId].lastTime = this.getMessageTimestamp(last) || this.conversations[userId].lastTime;
    } catch (err) {
      this.showToast('Could not load full conversation', 'error');
    }

    this.renderConversation();
  }

  showTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
      indicator.style.display = 'flex';
      const container = document.getElementById('messagesContainer');
      if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }

  hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.style.display = 'none';
  }

  renderConversation() {
    if (!this.currentChat) return;

    const conv = this.conversations[this.currentChat];
    if (!conv) return;
    this.currentChatUserRole = conv.role || this.currentChatUserRole || null;

    const chatArea = document.getElementById('chatArea');
    const messages = conv.messages || [];
    const canRequestPermission = this.canRequestPermission();
    const stats = this.getConversationStats(messages);
    const role = this.getDisplayRole(this.currentChatUserRole || conv.role);
    const draft = this.messageDrafts?.[this.currentChat] || '';

    chatArea.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-info">
          <button class="btn-back-inline-mobile" id="btnBackToList" title="Back to chats">
            <i class="fas fa-arrow-left"></i>
          </button>
          <div class="chat-avatar" style="background: ${this.getColorForUser(this.currentChat)}">
            ${this.getInitials(this.currentChatUser)}
            <span class="status-dot online"></span>
          </div>
          <div>
            <h3>${this.escapeHtml(this.currentChatUser)}</h3>
            <p>
              <span class="presence-label"><i class="fas fa-circle"></i> Available</span>
              <span class="header-user-id">${this.escapeHtml(this.currentChat)}</span>
              <span class="header-role-pill">${this.escapeHtml(role)}</span>
            </p>
          </div>
        </div>
        <div class="chat-header-actions">
          <button class="btn-icon" id="btnPinChat" title="${this.pinnedConversations.has(this.currentChat) ? 'Unpin chat' : 'Pin chat'}"><i class="fas fa-thumbtack"></i></button>
          <button class="btn-icon" id="btnClearChat" title="Clear chat"><i class="fas fa-trash"></i></button>
        </div>
      </div>

      <div class="thread-command-strip">
        <label class="thread-search">
          <i class="fas fa-magnifying-glass"></i>
          <input id="threadSearchInput" type="search" placeholder="Find in this thread" value="${this.escapeHtml(this.activeConversationQuery)}">
        </label>
        <div class="thread-metrics">
          <span><strong>${stats.total}</strong> messages</span>
          <span><strong>${stats.sent}</strong> sent</span>
          <span><strong>${stats.received}</strong> received</span>
          <span><strong>${stats.requests}</strong> requests</span>
        </div>
      </div>

      <div class="messages-container" id="messagesContainer"></div>
      <button class="jump-latest" id="btnJumpLatest" title="Jump to latest message"><i class="fas fa-arrow-down"></i></button>

      <div class="typing-indicator" id="typingIndicator" style="display: none;">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>

      <div class="message-input-area">
        <div class="composer-context">
          <span><i class="fas fa-lock"></i> Private FaceAttend thread</span>
          <span><i class="fas fa-bolt"></i> Type / for smart inserts</span>
          <span>Enter to send</span>
        </div>
        <div class="composer-main">
        <textarea id="messageInput" placeholder="Write a precise message, or type /late, /followup, /thanks..." class="message-input" rows="1" maxlength="1200">${this.escapeHtml(draft)}</textarea>
        ${canRequestPermission ? `
        <button class="btn-icon" id="btnPermissionRequest" title="Request Permission" style="display: flex; align-items: center; justify-content: center;">
          <i class="fas fa-file-shield"></i>
        </button>
        ` : ''}
        <button class="btn-send" id="btnSendMessage">
          <i class="fas fa-paper-plane"></i>
        </button>
        </div>
        <div class="composer-footer">
          <div class="quick-replies">
            <button type="button" data-quick-message="Thanks, noted.">Thanks, noted</button>
            <button type="button" data-quick-message="Can we discuss this today?">Discuss today</button>
            <button type="button" data-quick-message="I will follow up shortly.">Follow up</button>
            <button type="button" data-quick-message="Please share the exact time and date so I can verify it.">Ask for details</button>
          </div>
          <span class="composer-count" id="composerCount">0 / 1200</span>
        </div>
        <div class="command-suggestions" id="commandSuggestions">
          <button type="button" data-command-template="I may arrive late today due to an unavoidable delay. I will update once I reach campus.">/late - late arrival note</button>
          <button type="button" data-command-template="Please review this when you get a moment. I have added the necessary context above.">/review - review request</button>
          <button type="button" data-command-template="Thanks, noted. I will follow up shortly with the next update.">/thanks - concise acknowledgement</button>
        </div>
      </div>
    `;

    this.renderMessages(messages);
    this.attachMessageListeners();

    const btnBackToList = document.getElementById('btnBackToList');
    if (btnBackToList) {
      btnBackToList.addEventListener('click', () => this.exitChatView(false));
    }

    const btnClearChat = document.getElementById('btnClearChat');
    if (btnClearChat) {
      btnClearChat.addEventListener('click', async () => {
        await this.clearCurrentConversation();
      });
    }
    document.getElementById('btnPinChat')?.addEventListener('click', () => this.togglePinConversation(this.currentChat));
    document.getElementById('btnJumpLatest')?.addEventListener('click', () => {
      const container = document.getElementById('messagesContainer');
      container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    });
  }

  renderMessages(messages) {
    const container = document.getElementById('messagesContainer');
    if (!messages || !messages.length) {
      container.innerHTML = `
        <div class="messages-empty">
          <div class="empty-state-icon"><i class="fas fa-comments"></i></div>
          <h3>No messages yet</h3>
          <p>Start the conversation! 👋</p>
        </div>
      `;
      return;
    }

    let html = '';
    let lastDate = null;
    const query = String(this.activeConversationQuery || '').trim().toLowerCase();
    const visibleMessages = query
      ? messages.filter(msg => String(msg.content || '').toLowerCase().includes(query))
      : messages;

    if (!visibleMessages.length) {
      container.innerHTML = `
        <div class="messages-empty">
          <div class="empty-state-icon"><i class="fas fa-magnifying-glass"></i></div>
          <h3>No thread matches</h3>
          <p>Try a date, permission phrase, or a shorter keyword.</p>
        </div>
      `;
      return;
    }

    visibleMessages.forEach((msg, i) => {
      const msgDate = this.getMessageDate(msg);
      const dateLabel = msgDate.toLocaleDateString();

      if (dateLabel !== lastDate) {
        html += `<div class="date-separator"><span>${this.formatDateLabel(this.getMessageTimestamp(msg))}</span></div>`;
        lastDate = dateLabel;
      }

      const isSent = msg.sender_id === this.user.user_id;
      const isPermissionRequest = (msg.message_type || msg.type) === 'permission_request';

      const prevMsg = i > 0 ? visibleMessages[i-1] : null;
      const nextMsg = i < visibleMessages.length - 1 ? visibleMessages[i+1] : null;

      let isGroupedWithPrev = false;
      if (prevMsg) {
        const prevDate = this.getMessageDate(prevMsg);
        isGroupedWithPrev = prevMsg.sender_id === msg.sender_id && 
                            (msgDate - prevDate) < 5 * 60 * 1000 &&
                            prevDate.toLocaleDateString() === dateLabel &&
                            !((prevMsg.message_type || prevMsg.type) === 'permission_request');
      }

      let isGroupedWithNext = false;
      if (nextMsg) {
        const nextDate = this.getMessageDate(nextMsg);
        isGroupedWithNext = nextMsg.sender_id === msg.sender_id &&
                            (nextDate - msgDate) < 5 * 60 * 1000 &&
                            nextDate.toLocaleDateString() === dateLabel &&
                            !((nextMsg.message_type || nextMsg.type) === 'permission_request');
      }

      const showAvatar = !isGroupedWithPrev;
      const showMeta = !isGroupedWithNext;
      const groupClass = isGroupedWithPrev ? ' grouped' : '';
      
      const msgId = msg.id || `msg-${i}`;
      const reactions = this.messageReactions.get(msgId) || [];
      const reactionHtml = reactions.length ? `<div class="message-reactions">${reactions.join(' ')}</div>` : '';

      if (isPermissionRequest) {
        html += this.renderPermissionRequestCard(msg, isSent);
      } else {
        html += `
          <div class="message-row ${isSent ? 'sent' : 'received'}${groupClass}" data-msg-id="${msgId}">
            ${(!isSent && showAvatar) ? `<div class="message-avatar" style="background: ${this.getColorForUser(msg.sender_id)}">${this.getInitials(msg.sender_name || msg.sender_id)}</div>` : (!isSent ? '<div style="width:34px;flex-shrink:0"></div>' : '')}
            <div class="message-bubble">
              <div class="message-content">${this.escapeHtml(msg.content)}</div>
              ${showMeta ? `
              <div class="message-meta">
                <span class="message-time">${this.formatMessageTime(this.getMessageTimestamp(msg))}</span>
                ${isSent ? `<span class="message-status"><i class="fas fa-check${msg.is_read ? '-double' : ''}"></i></span>` : ''}
              </div>
              ` : ''}
              ${reactionHtml}
              <div class="msg-quick-actions">
                <button class="quick-action-btn" data-copy-message="${this.escapeHtml(msg.content)}" title="Copy"><i class="fas fa-copy"></i></button>
                <button class="quick-action-btn react-btn" data-msg-id="${msgId}" data-emoji="Seen" title="Seen"><i class="fas fa-eye"></i></button>
                <button class="quick-action-btn react-btn" data-msg-id="${msgId}" data-emoji="Priority" title="Priority"><i class="fas fa-star"></i></button>
              </div>
            </div>
          </div>
        `;
      }
    });

    container.innerHTML = html;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }

  toggleReaction(messageId, emoji) {
    let reactions = this.messageReactions.get(messageId) || [];
    if (reactions.includes(emoji)) {
      reactions = reactions.filter(r => r !== emoji);
    } else {
      reactions.push(emoji);
    }
    this.messageReactions.set(messageId, reactions);
    
    // Quick and dirty partial re-render if possible, or full re-render
    if (this.currentChat) {
      const conv = this.conversations[this.currentChat];
      if (conv) this.renderMessages(conv.messages || []);
    }
  }

  attachMessageListeners() {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('btnSendMessage');
    const permissionBtn = document.getElementById('btnPermissionRequest');
    const threadSearchInput = document.getElementById('threadSearchInput');
    const composerCount = document.getElementById('composerCount');
    const commandSuggestions = document.getElementById('commandSuggestions');
    const attachInfo = document.getElementById('btnAttachInfo');

    const updateComposerState = () => {
      if (!input) return;
      if (composerCount) composerCount.textContent = `${input.value.length} / 1200`;
      if (commandSuggestions) {
        commandSuggestions.classList.toggle('show', input.value.trim().startsWith('/'));
      }
    };

    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        this.saveDraftForCurrentChat(input.value);
        updateComposerState();

        const commandTemplate = this.getCommandTemplate(input.value);
        if (commandTemplate) {
          input.value = commandTemplate;
          input.style.height = 'auto';
          input.style.height = Math.min(input.scrollHeight, 120) + 'px';
          this.saveDraftForCurrentChat(input.value);
          updateComposerState();
        }
        
        this.showTypingIndicator();
        clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => this.hideTypingIndicator(), 1000);
      });

      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      updateComposerState();
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    if (permissionBtn) {
      permissionBtn.addEventListener('click', () => this.showPermissionRequestModal());
    }

    if (attachInfo) {
      attachInfo.addEventListener('click', () => {
        this.showToast('Attachments are handled through permission requests for now.', 'info');
      });
    }

    if (threadSearchInput) {
      threadSearchInput.addEventListener('input', (event) => {
        this.activeConversationQuery = event.target.value;
        const conv = this.conversations[this.currentChat];
        if (conv) this.renderMessages(conv.messages || []);
      });
    }

    document.querySelectorAll('[data-quick-message]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!input) return;
        input.value = button.dataset.quickMessage || '';
        input.focus();
        input.dispatchEvent(new Event('input'));
      });
    });

    document.querySelectorAll('[data-command-template]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!input) return;
        input.value = button.dataset.commandTemplate || '';
        input.focus();
        input.dispatchEvent(new Event('input'));
      });
    });

    const container = document.getElementById('messagesContainer');
    if (container) {
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('.react-btn');
        if (btn) {
          const msgId = btn.dataset.msgId;
          const emoji = btn.dataset.emoji;
          if (msgId && emoji) this.toggleReaction(msgId, emoji);
        }

        const copyBtn = e.target.closest('.copy-message-btn');
        if (copyBtn) {
          this.copyMessageToClipboard(copyBtn.dataset.copyMessage || '');
        }
      });
    }
  }

  async sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input?.value?.trim();

    if (!content || !this.currentChat) return;

    input.value = '';
    input.style.height = 'auto';
    this.saveDraftForCurrentChat('');

    const sendBtn = document.getElementById('btnSendMessage');
    if (sendBtn) {
      sendBtn.classList.add('send-pulse');
      setTimeout(() => sendBtn.classList.remove('send-pulse'), 400);
    }

    try {
      await fetch(`${this.API}/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: this.user.user_id,
          recipient_id: this.currentChat,
          title: 'Direct Message',
          content: content
        })
      });

      const optimisticMessage = {
        sender_id: this.user.user_id,
        sender_name: this.user.name || this.user.user_id,
        recipient_id: this.currentChat,
        recipient_name: this.currentChatUser,
        content,
        created_at: new Date().toISOString(),
        is_read: true
      };

      if (!this.conversations[this.currentChat]) {
        this.conversations[this.currentChat] = {
          id: this.currentChat,
          name: this.currentChatUser,
          messages: [],
          unread: 0,
          lastMessage: null,
          lastTime: null
        };
      }

      this.conversations[this.currentChat].messages.push(optimisticMessage);
      this.conversations[this.currentChat].lastMessage = content;
      this.conversations[this.currentChat].lastTime = optimisticMessage.created_at;
      this.renderConversation();
      this.renderConversations();

      await this.loadConversationMessages(this.currentChat, this.currentChatUser);
      this.showToast('Message sent ✓', 'success');
    } catch (err) {
      console.error('Failed to send message:', err);
      this.showToast('Failed to send message', 'error');
    }
  }

  switchTab(tab) {
    this.activeTab = tab;
    const searchContainer = document.querySelector('.search-container');
    
    // Update active state on tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    switch (tab) {
      case 'messages':
        this.updateHeaderSubtitle('Messages');
        this.renderConversations();
        if (searchContainer) searchContainer.style.display = 'flex';
        if (this.currentChat) {
          this.openConversation(this.currentChat, this.currentChatUser);
        } else {
          this.exitChatView(true);
        }
        break;
      case 'alerts':
        this.updateHeaderSubtitle('Alerts');
        this.loadAlerts();
        if (searchContainer) searchContainer.style.display = 'none';
        break;
      case 'assistant':
        this.updateHeaderSubtitle('FaceAttend Assistant 🤖');
        this.renderAssistant();
        if (searchContainer) searchContainer.style.display = 'none';
        this.enterChatView();
        break;
      case 'broadcast':
        this.updateHeaderSubtitle('Broadcast');
        if (searchContainer) searchContainer.style.display = 'none';
        if (this.isAdmin) {
          this.renderBroadcast();
          this.enterChatView();
        }
        break;
    }
  }

  async loadAlerts() {
    const convList = document.getElementById('convList');
    if (convList) {
      convList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-spinner loading"></i>
          <p>Loading alerts...</p>
        </div>
      `;
    }

    try {
      const res = await fetch(`${this.API}/alerts/pinned/${this.user.user_id}`);
      const data = await res.json();
      const incoming = data.alerts || [];
      this.alerts = incoming.map(alert => ({
        ...alert,
        content: alert.content || alert.message || '',
        priority: this.normalizePriority(alert.priority || alert.type)
      }));

      this.alerts.sort((a, b) => {
        const pa = this.priorityRank(a.priority);
        const pb = this.priorityRank(b.priority);
        if (pa !== pb) return pa - pb;
        return this.getMessageDate(b) - this.getMessageDate(a);
      });
      
      const unread = this.alerts.filter(a => !a.is_read).length;
      const badge = document.getElementById('alertBadge');
      if (badge) {
        badge.textContent = unread;
        badge.style.display = unread > 0 ? 'inline-block' : 'none';
      }

      this.renderAlerts();
    } catch (err) {
      console.error('Failed to load alerts:', err);
      if (convList) {
        convList.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-bell-slash"></i>
            <p>Unable to load alerts</p>
          </div>
        `;
      }
    }
  }

  renderAlerts() {
    const convList = document.getElementById('convList');
    if (!this.alerts.length) {
      convList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-bell-slash"></i>
          <p>You're all caught up!</p>
        </div>
      `;
      return;
    }

    convList.innerHTML = `
      <div class="alerts-toolbar">
        <div>
          <span class="alerts-kicker">Pinned updates</span>
          <h4>Actionable alerts</h4>
        </div>
        <span class="alerts-counter">${this.alerts.length}</span>
      </div>
    ` + this.alerts.map((alert, idx) => `
      <div class="alert-item" data-alert-index="${idx}">
        <div class="alert-priority-indicator" style="background: ${this.getPriorityColor(alert.priority)}"></div>
        <div class="alert-content">
          <h4 class="alert-title">${this.escapeHtml(alert.title)}</h4>
          <p class="alert-preview">${this.escapeHtml(alert.content?.substring(0, 60) || '')}</p>
          <span class="alert-time">${this.formatTime(this.getMessageTimestamp(alert))}</span>
        </div>
        ${this.isAdmin ? `
          <button class="alert-delete-btn" data-delete-alert-id="${alert.id}" title="Delete for everyone">
            <i class="fas fa-trash"></i>
          </button>
        ` : ''}
        ${!alert.is_read ? '<span class="unread-dot"></span>' : ''}
      </div>
    `).join('');

    convList.querySelectorAll('.alert-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = Number(item.dataset.alertIndex);
        const alert = this.alerts[idx];
        if (alert) this.openAlert(alert);
      });
    });

    convList.querySelectorAll('.alert-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const alertId = btn.getAttribute('data-delete-alert-id');
        if (alertId) await this.deleteAlertEverywhere(alertId);
      });
    });
  }

  openAlert(alert) {
    const chatArea = document.getElementById('chatArea');
    chatArea.innerHTML = `
      <div class="alert-viewer">
        <button class="btn-back-inline" onclick="chatInterface.backToAlertsList()">← Back</button>
        <div class="alert-header" style="border-left: 4px solid ${this.getPriorityColor(alert.priority)}">
          <span class="alert-badge" style="background: ${this.getPriorityColor(alert.priority)}">${alert.priority?.toUpperCase()}</span>
          <h2>${this.escapeHtml(alert.title)}</h2>
          <p class="alert-meta">${this.parseTimestamp(this.getMessageTimestamp(alert) || Date.now()).toLocaleString()}</p>
        </div>
        <div class="alert-body">
          ${this.escapeHtml(alert.content)}
        </div>
        <div class="alert-viewer-actions">
          ${this.isAdmin ? `<button class="btn-secondary" onclick="chatInterface.deleteAlertEverywhere('${alert.id}')">Delete for everyone</button>` : ''}
          <button class="btn-primary" onclick="chatInterface.dismissAlert('${alert.id}')">${this.isAdmin ? 'Hide my copy' : 'Dismiss'}</button>
        </div>
      </div>
    `;

    this.enterChatView();
  }

  backToAlertsList() {
    this.loadAlerts();
    this.exitChatView(false);
  }

  async dismissAlert(alertId) {
    try {
      await fetch(`${this.API}/alerts/${alertId}/unpin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: this.user.user_id })
      });
      this.loadAlerts();
      this.showToast('Alert dismissed', 'success');
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  }

  async deleteAlertEverywhere(alertId) {
    if (!this.isAdmin) return;
    const ok = confirm('Delete this alert for every faculty member and remove the admin copy too?');
    if (!ok) return;

    try {
      const res = await fetch(`${this.API}/admin/alerts/${alertId}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: this.user.user_id })
      });

      if (!res.ok) throw new Error('Failed');

      this.alerts = this.alerts.filter((alert) => String(alert.id) !== String(alertId));
      this.renderAlerts();
      this.exitChatView(false);
      this.showToast('Alert deleted for everyone', 'success');
    } catch (err) {
      console.error('Failed to delete admin alert:', err);
      this.showToast('Failed to delete alert for everyone', 'error');
    }
  }

  async clearAllAlerts() {
    const ok = confirm('Clear all existing alerts from your list?');
    if (!ok) return;

    try {
      const res = await fetch(`${this.API}/alerts/clear_all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: this.user.user_id })
      });

      if (!res.ok) throw new Error('Failed');

      this.alerts = [];
      await this.loadAlerts();
      this.showToast('All alerts cleared', 'success');
    } catch (err) {
      this.showToast('Failed to clear alerts', 'error');
    }
  }

  renderAssistant() {
    const convList = document.getElementById('convList');
    const chatArea = document.getElementById('chatArea');

    const categories = this.getAssistantCatalog();
    const activeCategory = this.getAssistantCategory(this.assistantActiveCategory) || categories[0];
    const connectionMeta = this.getAssistantConnectionMeta();
    const topicPreview = activeCategory?.topics?.slice(0, 4) || [];

    convList.innerHTML = `
      <div class="assistant-side-shell">
        <div class="assistant-connection-card state-${this.assistantConnectionState}">
          <div class="assistant-connection-copy">
            <span class="assistant-eyebrow">Live assistant bridge</span>
            <h4>${this.escapeHtml(connectionMeta.title)}</h4>
            <p>${this.escapeHtml(connectionMeta.description)}</p>
          </div>
          <button class="assistant-connect-btn ${this.assistantConnectionState === 'connecting' ? 'is-loading' : ''}" type="button" onclick="chatInterface.connectRealAssistant()" ${this.assistantConnectionState === 'connecting' ? 'disabled' : ''}>
            ${connectionMeta.buttonLabel}
          </button>
        </div>

        <div class="assistant-section-shell">
          <div class="assistant-section-head">
            <span>Categories</span>
            <small>${categories.length} areas</small>
          </div>
          <div class="assistant-category-list" id="sidebarAssistantCategoryList">
            ${categories.map((category) => `
              <button type="button" class="assistant-category-chip ${category.key === activeCategory.key ? 'active' : ''}" onclick="chatInterface.setAssistantCategory('${category.key}')">
                <strong>${this.escapeHtml(category.title)}</strong>
                <span>${this.escapeHtml(category.description)}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="assistant-section-shell">
          <div class="assistant-section-head">
            <span>Suggested topics</span>
            <small id="sidebarAssistantTopicCount">${topicPreview.length} quick asks</small>
          </div>
          <div class="assistant-topic-list" id="sidebarAssistantTopicList">
            ${topicPreview.map((topic) => `
              <button type="button" class="assistant-topic-card" onclick="chatInterface.askAI(${JSON.stringify(topic.title)})">
                <span class="assistant-topic-tag">${this.escapeHtml(activeCategory.title)}</span>
                <strong>${this.escapeHtml(topic.title)}</strong>
                <p>${this.escapeHtml(this.trimAssistantAnswer(topic.answer, 118))}</p>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    chatArea.innerHTML = `
      <div class="assistant-stage">
        <section class="assistant-hero-card">
          <div class="assistant-hero-copy">
            <span class="assistant-eyebrow">FaceAttend knowledge engine</span>
            <h2>Ask anything about how this project works</h2>
            <p>It explains login, face scans, leave and permission flow, admin tools, reports, alerts, troubleshooting, and the system architecture behind the app.</p>
          </div>
        </section>

        <section class="assistant-discovery-panel">
          <div class="assistant-discovery-grid">
            <div class="assistant-discovery-block">
              <h4>Categories</h4>
              <div class="assistant-category-list discovery-list" id="mobileAssistantCategoryList">
                ${categories.map((category) => `
                  <button type="button" class="assistant-category-chip ${category.key === activeCategory.key ? 'active' : ''}" onclick="chatInterface.setAssistantCategory('${category.key}')">
                    <strong>${this.escapeHtml(category.title)}</strong>
                    <span>${this.escapeHtml(category.description)}</span>
                  </button>
                `).join('')}
              </div>
            </div>
            
            <div class="assistant-discovery-block">
              <h4 id="mobileAssistantTopicCount">Suggested topics (${topicPreview.length})</h4>
              <div class="assistant-topic-list discovery-list" id="mobileAssistantTopicList">
                ${topicPreview.map((topic) => `
                  <button type="button" class="assistant-topic-card" onclick="chatInterface.askAI(${JSON.stringify(topic.title)})">
                    <span class="assistant-topic-tag">${this.escapeHtml(activeCategory.title)}</span>
                    <strong>${this.escapeHtml(topic.title)}</strong>
                    <p>${this.escapeHtml(this.trimAssistantAnswer(topic.answer, 118))}</p>
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
          </div>
        </section>

        <div class="ai-chat assistant-chat-shell">
          <div class="ai-welcome assistant-welcome-card">
            <p>I can explain the full FaceAttend workflow in plain language. Pick a topic, ask your own question, or connect the live assistant bridge when you are ready.</p>
            <div class="assistant-prompt-row">
              <button class="assistant-prompt-btn secondary" type="button" onclick="chatInterface.connectRealAssistant()">Connect with the Support Bridge</button>
            </div>
          </div>

          <div class="assistant-status-strip ${this.assistantConnectionState}">
            <i class="fas ${this.assistantConnectionState === 'connecting' ? 'fa-spinner loading' : this.assistantConnectionState === 'connected' ? 'fa-link' : 'fa-circle-info'}"></i>
            <span>${this.escapeHtml(connectionMeta.statusText)}</span>
          </div>

          <div class="ai-messages" id="aiMessages">
            <div class="ai-message bot assistant-system-message">
              <div class="ai-message-source">Local knowledge</div>
              <div class="ai-message-content">Ask a question or tap any topic card. I will answer with the project's actual flow, screens, and behavior.</div>
            </div>
          </div>

          <div class="ai-input assistant-input-shell">
            <input type="text" id="aiInput" placeholder="Ask me anything…" class="ai-input-field" aria-label="Ask the assistant a question">
            <button class="btn-send assistant-send-btn" type="button" onclick="chatInterface.sendAIMessage()" aria-label="Send question">
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('aiInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendAIMessage();
    });
  }

  async sendAIMessage() {
    const input = document.getElementById('aiInput');
    const question = input?.value?.trim();
    if (!question) return;

    const messagesDiv = document.getElementById('aiMessages');
    if (messagesDiv) {
      messagesDiv.innerHTML += `
        <div class="ai-message user">
          <div class="ai-message-content">${this.escapeHtml(question)}</div>
        </div>
      `;
      messagesDiv.innerHTML += `
        <div class="ai-message bot ai-message-pending" id="assistantThinkingMessage">
          <div class="ai-message-source">${this.assistantConnectionState === 'connected' ? 'Live bridge' : 'Local knowledge'}</div>
          <div class="ai-message-content"><span class="assistant-thinking-dot"></span>Thinking through the project context…</div>
        </div>
      `;
      this.scrollAssistantMessages();
    }

    input.value = '';

    try {
      const response = await this.getAssistantResponse(question);

      if (messagesDiv) {
        const pending = document.getElementById('assistantThinkingMessage');
        if (pending) pending.remove();

        messagesDiv.innerHTML += `
          <div class="ai-message bot">
            <div class="ai-message-source">${this.escapeHtml(response.sourceLabel || 'FaceAttend assistant')}</div>
            <div class="ai-message-content">${this.escapeHtml(response.answer)}</div>
          </div>
        `;

        this.scrollAssistantMessages();
      }
    } catch (err) {
      if (messagesDiv) {
        const pending = document.getElementById('assistantThinkingMessage');
        if (pending) pending.remove();
        const fallback = this.getLocalAssistantResponse(question);
        messagesDiv.innerHTML += `
          <div class="ai-message bot error">
            <div class="ai-message-source">Local fallback</div>
            <div class="ai-message-content">${this.escapeHtml(fallback.answer)}</div>
          </div>
        `;
        this.scrollAssistantMessages();
      }
    }
  }

  askAI(question) {
    const aiInput = document.getElementById('aiInput');
    if (aiInput) {
      aiInput.value = question;
      aiInput.focus();
      setTimeout(() => this.sendAIMessage(), 100);
    }
  }

  setAssistantCategory(categoryKey) {
    const available = this.getAssistantCategory(categoryKey);
    if (!available) return;
    this.assistantActiveCategory = available.key;
    
    // Instead of completely re-rendering the chatArea (which destroys chat history),
    // selectively update the discovery UI.
    this.updateAssistantDiscoveryUI();
  }

  updateAssistantDiscoveryUI() {
    const activeCategory = this.getAssistantCategory(this.assistantActiveCategory) || this.getAssistantCatalog()[0];
    const topicPreview = activeCategory?.topics?.slice(0, 4) || [];

    // 1. Update active states on category chips
    document.querySelectorAll('.assistant-category-chip').forEach(chip => {
      const clickAttr = chip.getAttribute('onclick') || '';
      chip.classList.toggle('active', clickAttr.includes(`'${activeCategory.key}'`));
    });

    // 2. Re-render topic list HTML
    const topicHTML = topicPreview.map((topic) => `
      <button type="button" class="assistant-topic-card" onclick="chatInterface.askAI(${JSON.stringify(topic.title)})">
        <span class="assistant-topic-tag">${this.escapeHtml(activeCategory.title)}</span>
        <strong>${this.escapeHtml(topic.title)}</strong>
        <p>${this.escapeHtml(this.trimAssistantAnswer(topic.answer, 118))}</p>
      </button>
    `).join('');

    // Update Sidebar
    const sidebarTopics = document.getElementById('sidebarAssistantTopicList');
    const sidebarCount = document.getElementById('sidebarAssistantTopicCount');
    if (sidebarTopics) sidebarTopics.innerHTML = topicHTML;
    if (sidebarCount) sidebarCount.textContent = `${topicPreview.length} quick asks`;

    // Update Mobile Discovery Panel
    const mobileTopics = document.getElementById('mobileAssistantTopicList');
    const mobileCount = document.getElementById('mobileAssistantTopicCount');
    if (mobileTopics) mobileTopics.innerHTML = topicHTML;
    if (mobileCount) mobileCount.textContent = `Suggested topics (${topicPreview.length})`;
  }

  connectRealAssistant() {
    this.assistantConnectionState = 'live_support_view';
    const mainContainer = document.querySelector('.chat-main');
    if (mainContainer) mainContainer.style.display = 'none';
    
    let liveContainer = document.getElementById('liveSupportContainer');
    if (!liveContainer) {
      liveContainer = document.createElement('div');
      liveContainer.id = 'liveSupportContainer';
      liveContainer.className = 'live-support-container';
      document.querySelector('.chat-container').appendChild(liveContainer);
    }
    liveContainer.style.display = 'flex';
    
    this.renderLiveSupport(liveContainer);
  }

  renderLiveSupport(container) {
    if (this.isAdmin) {
      this.renderAdminLiveSupport(container);
    } else {
      this.renderUserLiveSupport(container);
    }
  }

  closeLiveSupport() {
    this.assistantConnectionState = 'local';
    const mainContainer = document.querySelector('.chat-main');
    if (mainContainer) mainContainer.style.display = 'flex';
    
    const liveContainer = document.getElementById('liveSupportContainer');
    if (liveContainer) liveContainer.style.display = 'none';
    
    if (this.liveSupportPollInterval) clearInterval(this.liveSupportPollInterval);
    this.updateHeaderSubtitle('FaceAttend Assistant 🤖');
  }

  // ==========================================
  // REAL ASSISTANT LIVE SUPPORT - USER
  // ==========================================
  
  async renderUserLiveSupport(container) {
    this.updateHeaderSubtitle('Smart Bridge');
    container.innerHTML = `
      <div class="ls-user-layout">
        <div class="ls-user-header">
          <button class="ls-btn-back" onclick="chatInterface.closeLiveSupport()">
            <i class="fas fa-arrow-left"></i> Back to Assistant
          </button>
          <div class="ls-agent-info">
            <div class="ls-avatar-premium">
              <div class="ls-avatar-ring"><i class="fas fa-headset"></i></div>
            </div>
            <div class="ls-agent-details">
              <h3>Smart Bridge</h3>
              <span id="lsUserStatusText" class="ls-status-badge">Initializing...</span>
            </div>
          </div>
        </div>
        
        <div id="lsUserBody" class="ls-user-body">
          <div class="ls-connect-splash" id="lsConnectSplash">
            <div class="ls-splash-visual">
              <div class="ls-orb-container">
                <div class="ls-orb"></div>
                <div class="ls-orb-ring"></div>
                <div class="ls-orb-ring ls-orb-ring-2"></div>
              </div>
              <div class="ls-splash-icon-wrap"><i class="fas fa-satellite-dish"></i></div>
            </div>
            <div class="ls-splash-content">
              <span class="ls-splash-kicker">LIVE SUPPORT</span>
              <h2>Smart Bridge</h2>
              <p>Connect directly with admin support for real-time guidance, issue resolution, and exception approvals.</p>
            </div>
            <div class="ls-splash-actions">
              <button id="lsBtnConnect" class="ls-btn-connect" onclick="chatInterface.requestLiveSupport()">
                <span class="ls-btn-connect-content">
                  <i class="fas fa-bolt"></i>
                  <span>Establish Connection</span>
                </span>
              </button>
              <button id="lsBtnCancel" class="ls-btn-cancel" style="display: none;" onclick="chatInterface.cancelLiveSupport()">
                <i class="fas fa-xmark"></i> Cancel Request
              </button>
              <button id="lsBtnHistory" class="ls-btn-tool" style="margin-top: 1rem; width: 100%; justify-content: center; background: #e5e7eb; color: #374151; padding: 0.75rem;" onclick="chatInterface.showPreviousSessions()">
                <i class="fas fa-clock-rotate-left"></i> Previous Sessions
              </button>
            </div>
            <div class="ls-splash-footer">
              <i class="fas fa-shield-halved"></i>
              <span>End-to-end encrypted · Admin-verified responses</span>
            </div>
          </div>
          
          <div class="ls-chat-interface" id="lsChatInterface" style="display: none;">
            <div class="ls-connected-banner" id="lsConnectedBanner">
              <div class="ls-connected-pulse"></div>
              <i class="fas fa-link"></i>
              <span>Smart Bridge Connected</span>
            </div>
            <div class="ls-messages-scroll" id="lsUserMessages"></div>
            <div class="ls-chat-input-wrapper">
              <div class="ls-chat-input-container">
                <textarea id="lsUserMsgInput" placeholder="Message Support Bridge..." rows="1" onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); chatInterface.sendLiveMessage(); }"></textarea>
                <div class="ls-chat-input-actions">
                  <div class="ls-chat-input-tools">
                    <button class="ls-btn-tool" id="lsBtnPermissionRequest" onclick="chatInterface.showPermissionRequestModal()" title="Raise Exception Proposal">
                      <i class="fas fa-file-shield"></i> Raise Exception
                    </button>
                  </div>
                  <button class="ls-btn-submit" onclick="chatInterface.sendLiveMessage()">Send <i class="fas fa-paper-plane"></i></button>
                </div>
              </div>
            </div>
          </div>
          
          <div class="ls-chat-interface" id="lsHistoryInterface" style="display: none; background: #ffffff;">
            <div class="ls-chat-header" style="background: #ffffff; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 1rem;">
              <button class="ls-mobile-back" onclick="chatInterface.hidePreviousSessions()"><i class="fas fa-chevron-left"></i></button>
              <h3 style="margin: 0; font-size: 1.1rem; color: #111827;">Previous Sessions</h3>
            </div>
            <div class="ls-messages-scroll" id="lsHistoryList" style="padding: 1rem;">
              <!-- History List will be rendered here -->
            </div>
          </div>

          <div class="ls-chat-interface" id="lsHistoryViewInterface" style="display: none; background: #f9fafb;">
            <div class="ls-chat-header" style="background: #ffffff; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 1rem; z-index: 2;">
              <button class="ls-mobile-back" onclick="chatInterface.showPreviousSessions()"><i class="fas fa-chevron-left"></i></button>
              <h3 style="margin: 0; font-size: 1.1rem; color: #111827;">Archived Transcript</h3>
            </div>
            <div class="ls-messages-scroll" id="lsHistoryViewMessages">
              <!-- Archived messages will be rendered here -->
            </div>
          </div>
        </div>
      </div>
    `;
    this.refreshUserLiveSupportStatus();
  }

  async refreshUserLiveSupportStatus() {
    // This is now purely event-driven. We only do this once on initial load.
    try {
      const res = await fetch(`${this.API}/assistant/status/${this.user.user_id}?_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.status !== 'disconnected') {
        this.currentLiveSession = { id: data.connection_id, status: data.status };
      } else {
        this.currentLiveSession = null;
      }
      this.updateUserLiveSupportUI();
    } catch (e) {
      console.error('Failed to get status', e);
    }
  }

  updateUserLiveSupportUI() {
    const splash = document.getElementById('lsConnectSplash');
    const chatUI = document.getElementById('lsChatInterface');
    const btnConnect = document.getElementById('lsBtnConnect');
    const btnCancel = document.getElementById('lsBtnCancel');
    const statusText = document.getElementById('lsUserStatusText');
    if (!splash) return;

    if (!this.currentLiveSession || this.currentLiveSession.status === 'disconnected') {
      splash.style.display = 'flex';
      chatUI.style.display = 'none';
      splash.classList.remove('is-connecting');
      btnConnect.innerHTML = '<span class="ls-btn-connect-content"><i class="fas fa-bolt"></i><span>Establish Connection</span></span>';
      btnConnect.className = 'ls-btn-connect';
      btnConnect.disabled = false;
      btnCancel.style.display = 'none';
      statusText.innerHTML = '<span class="ls-dot available"></span> Available';
      statusText.className = 'ls-status-badge available';
    } else if (this.currentLiveSession.status === 'connecting') {
      splash.style.display = 'flex';
      chatUI.style.display = 'none';
      splash.classList.add('is-connecting');
      btnConnect.innerHTML = '<span class="ls-btn-connect-content"><i class="fas fa-spinner fa-spin"></i><span>Connecting...</span></span>';
      btnConnect.className = 'ls-btn-connect connecting';
      btnConnect.disabled = true;
      btnCancel.style.display = 'flex';
      statusText.innerHTML = '<span class="ls-dot connecting"></span> Requesting...';
      statusText.className = 'ls-status-badge connecting';
    } else if (this.currentLiveSession.status === 'connected') {
      splash.style.display = 'none';
      chatUI.style.display = 'flex';
      statusText.innerHTML = '<span class="ls-dot green"></span> Connected';
      statusText.className = 'ls-status-badge connected';
      this.loadLiveMessages('lsUserMessages');
    }
  }

  async requestLiveSupport() {
    try {
      // Optimistic UI update
      this.currentLiveSession = { id: 'temp', status: 'connecting' };
      this.updateUserLiveSupportUI();
      
      const res = await fetch(`${this.API}/assistant/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: this.user.user_id })
      });
      const data = await res.json();
      if (data.success) {
        this.currentLiveSession = { id: data.connection.id, status: data.connection.status };
      } else {
        this.currentLiveSession = null;
        this.showToast('Failed to connect', 'error');
      }
      this.updateUserLiveSupportUI();
    } catch (e) {
      this.currentLiveSession = null;
      this.updateUserLiveSupportUI();
      this.showToast('Failed to connect', 'error');
    }
  }

  async cancelLiveSupport() {
    try {
      // Optimistic UI update
      this.currentLiveSession = null;
      this.updateUserLiveSupportUI();
      
      await fetch(`${this.API}/assistant/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: this.user.user_id })
      });
    } catch (e) {
      // ignore
    }
  }

  async showPreviousSessions() {
    document.getElementById('lsConnectSplash').style.display = 'none';
    document.getElementById('lsChatInterface').style.display = 'none';
    document.getElementById('lsHistoryViewInterface').style.display = 'none';
    const historyUI = document.getElementById('lsHistoryInterface');
    historyUI.style.display = 'flex';
    
    const listContainer = document.getElementById('lsHistoryList');
    listContainer.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    
    try {
      const res = await fetch(`${this.API}/assistant/history/${this.user.user_id}`);
      const data = await res.json();
      
      if (!data.success || !data.sessions || data.sessions.length === 0) {
        listContainer.innerHTML = '<div class="ls-empty-chat"><i class="fas fa-box-open" style="font-size: 2rem;"></i><p>No previous sessions found.</p></div>';
        return;
      }
      
      listContainer.innerHTML = data.sessions.map(s => {
        const date = new Date(s.timestamp).toLocaleDateString();
        const time = new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 1rem; border-radius: 12px; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#d1d5db'" onmouseout="this.style.borderColor='#e5e7eb'">
            <div style="flex: 1;" onclick="chatInterface.viewPreviousSession('${s.session_id}', '${date} ${time}')">
              <div style="font-weight: 600; color: #111827; margin-bottom: 0.25rem;">Live Support Session</div>
              <div style="font-size: 0.85rem; color: #6b7280;"><i class="fas fa-calendar-alt"></i> ${date} at ${time}</div>
            </div>
            <button onclick="chatInterface.deletePreviousSession('${s.session_id}', event)" style="background: transparent; border: none; color: #ef4444; padding: 0.5rem; cursor: pointer; border-radius: 6px;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='transparent'">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `;
      }).join('');
      
    } catch (e) {
      listContainer.innerHTML = '<div class="ls-empty-chat">Failed to load sessions.</div>';
    }
  }

  hidePreviousSessions() {
    document.getElementById('lsHistoryInterface').style.display = 'none';
    document.getElementById('lsHistoryViewInterface').style.display = 'none';
    this.updateUserLiveSupportUI();
  }

  async viewPreviousSession(sessionId, datetime) {
    document.getElementById('lsHistoryInterface').style.display = 'none';
    const viewUI = document.getElementById('lsHistoryViewInterface');
    viewUI.style.display = 'flex';
    
    const messagesContainer = document.getElementById('lsHistoryViewMessages');
    messagesContainer.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    
    try {
      const res = await fetch(`${this.API}/assistant/history/session/${sessionId}`);
      const data = await res.json();
      
      if (!data.success || !data.messages || data.messages.length === 0) {
        messagesContainer.innerHTML = '<div class="ls-empty-chat">Transcript empty or deleted.</div>';
        return;
      }
      
      messagesContainer.innerHTML = data.messages.map(msg => {
        const isMe = String(msg.sender_id) === String(this.user.user_id);
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const name = isMe ? 'You' : 'Support Agent';
        
        const avatarHtml = isMe ? '' : `
            <div class="ls-msg-avatar">
              <i class="fas fa-shield-halved"></i>
            </div>`;

        return `
          <div class="ls-msg-row ${isMe ? 'me' : 'them'}">
            ${avatarHtml}
            <div class="ls-msg-content">
              <div class="ls-msg-header">
                <span class="ls-msg-name">${this.escapeHtml(name)}</span>
                <span class="ls-msg-time">${time}</span>
              </div>
              <div class="ls-msg-body">
                ${this.escapeHtml(msg.content).replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
        `;
      }).join('');
      
    } catch (e) {
      messagesContainer.innerHTML = '<div class="ls-empty-chat">Failed to load transcript.</div>';
    }
  }

  async deletePreviousSession(sessionId, event) {
    if (event) event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this session transcript?')) return;
    
    try {
      const res = await fetch(`${this.API}/assistant/history/session/${sessionId}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (data.success) {
        this.showToast('Session deleted', 'success');
        this.showPreviousSessions(); // Refresh list
      } else {
        this.showToast('Failed to delete', 'error');
      }
    } catch (e) {
      this.showToast('Failed to delete', 'error');
    }
  }

  async showAdminPreviousSessions() {
    const layout = document.querySelector('.ls-admin-layout');
    if (layout) layout.classList.add('chat-active');
    
    document.getElementById('lsAdminChatArea').style.display = 'none';
    document.getElementById('lsAdminHistoryViewArea').style.display = 'none';
    const historyUI = document.getElementById('lsAdminHistoryArea');
    historyUI.style.display = 'flex';
    
    const listContainer = document.getElementById('lsAdminHistoryList');
    listContainer.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    
    try {
      const res = await fetch(`${this.API}/assistant/history/${this.user.user_id}`);
      const data = await res.json();
      
      if (!data.success || !data.sessions || data.sessions.length === 0) {
        listContainer.innerHTML = '<div class="ls-empty-chat"><i class="fas fa-box-open" style="font-size: 2rem;"></i><p>No previous sessions found.</p></div>';
        return;
      }
      
      listContainer.innerHTML = data.sessions.map(s => {
        const date = new Date(s.timestamp).toLocaleDateString();
        const time = new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 1rem; border-radius: 12px; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#d1d5db'" onmouseout="this.style.borderColor='#e5e7eb'">
            <div style="flex: 1;" onclick="chatInterface.viewAdminPreviousSession('${s.session_id}', '${date} ${time}', '${s.other_user_name ? this.escapeHtml(s.other_user_name.replace(/'/g, "\\'")) : 'Unknown'}', '${s.other_user_id ? this.escapeHtml(s.other_user_id.replace(/'/g, "\\'")) : ''}')">
              <div style="font-weight: 600; color: #111827; margin-bottom: 0.25rem;">${s.other_user_name ? this.escapeHtml(s.other_user_name) : 'Live Support Session'} ${s.other_user_id ? '<span style="font-size: 0.75rem; color: #6b7280; font-weight: normal; background: #e5e7eb; padding: 0.1rem 0.4rem; border-radius: 4px; margin-left: 0.4rem;">' + this.escapeHtml(s.other_user_id) + '</span>' : ''}</div>
              <div style="font-size: 0.85rem; color: #6b7280;"><i class="fas fa-calendar-alt"></i> ${date} at ${time}</div>
            </div>
            <button onclick="chatInterface.deleteAdminPreviousSession('${s.session_id}', event)" style="background: transparent; border: none; color: #ef4444; padding: 0.5rem; cursor: pointer; border-radius: 6px;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='transparent'">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `;
      }).join('');
      
    } catch (e) {
      listContainer.innerHTML = '<div class="ls-empty-chat">Failed to load sessions.</div>';
    }
  }

  hideAdminPreviousSessions() {
    const layout = document.querySelector('.ls-admin-layout');
    if (layout) layout.classList.remove('chat-active');
    
    document.getElementById('lsAdminHistoryArea').style.display = 'none';
    document.getElementById('lsAdminHistoryViewArea').style.display = 'none';
    document.getElementById('lsAdminChatArea').style.display = 'flex';
  }

  async viewAdminPreviousSession(sessionId, datetime, otherName = 'Faculty', otherId = '') {
    document.getElementById('lsAdminHistoryArea').style.display = 'none';
    const viewUI = document.getElementById('lsAdminHistoryViewArea');
    viewUI.style.display = 'flex';
    
    // Update header dynamically
    const headerTitle = viewUI.querySelector('h3');
    if (headerTitle) {
      headerTitle.innerHTML = `Transcript: ${this.escapeHtml(otherName)} ${otherId ? '<span style="font-size: 0.8rem; font-weight: normal; color: #6b7280;">(' + this.escapeHtml(otherId) + ')</span>' : ''}`;
    }
    
    const messagesContainer = document.getElementById('lsAdminHistoryViewMessages');
    messagesContainer.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    
    try {
      const res = await fetch(`${this.API}/assistant/history/session/${sessionId}`);
      const data = await res.json();
      
      if (!data.success || !data.messages || data.messages.length === 0) {
        messagesContainer.innerHTML = '<div class="ls-empty-chat">Transcript empty or deleted.</div>';
        return;
      }
      
      messagesContainer.innerHTML = data.messages.map(msg => {
        const isMe = String(msg.sender_id) === String(this.user.user_id);
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const name = isMe ? 'You' : 'Faculty';
        
        const avatarHtml = isMe ? '' : `
            <div class="ls-msg-avatar">
              <i class="fas fa-user"></i>
            </div>`;

        return `
          <div class="ls-msg-row ${isMe ? 'me' : 'them'}">
            ${avatarHtml}
            <div class="ls-msg-content">
              <div class="ls-msg-header">
                <span class="ls-msg-name">${this.escapeHtml(name)}</span>
                <span class="ls-msg-time">${time}</span>
              </div>
              <div class="ls-msg-body">
                ${this.escapeHtml(msg.content).replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
        `;
      }).join('');
      
    } catch (e) {
      messagesContainer.innerHTML = '<div class="ls-empty-chat">Failed to load transcript.</div>';
    }
  }

  async deleteAdminPreviousSession(sessionId, event) {
    if (event) event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this session transcript?')) return;
    
    try {
      const res = await fetch(`${this.API}/assistant/history/session/${sessionId}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (data.success) {
        this.showToast('Session deleted', 'success');
        this.showAdminPreviousSessions(); // Refresh list
      } else {
        this.showToast('Failed to delete', 'error');
      }
    } catch (e) {
      this.showToast('Failed to delete', 'error');
    }
  }

  // ==========================================
  // REAL ASSISTANT LIVE SUPPORT - ADMIN
  // ==========================================
  
  renderAdminLiveSupport(container) {
    this.updateHeaderSubtitle('Support Command Center');
    container.innerHTML = `
      <div class="ls-admin-layout">
        <div class="ls-admin-sidebar">
          <div class="ls-sidebar-header">
            <button class="ls-btn-back-icon" onclick="chatInterface.closeLiveSupport()" title="Back">
              <i class="fas fa-arrow-left"></i>
            </button>
            <div class="ls-sidebar-title">
              <h2>Support Inbox</h2>
              <span class="ls-sidebar-subtitle" id="lsQueueCount">Loading...</span>
            </div>
            <button class="ls-btn-back-icon" onclick="chatInterface.showAdminPreviousSessions()" title="Previous Sessions" style="margin-left: auto;">
              <i class="fas fa-clock-rotate-left"></i>
            </button>
          </div>
          <div class="ls-sidebar-list" id="lsAdminQueueList">
             <div class="ls-empty-sidebar"><i class="fas fa-spinner fa-spin"></i><span>Loading queue...</span></div>
          </div>
        </div>
        
        <div class="ls-admin-main" id="lsAdminChatArea">
           <div class="ls-chat-placeholder">
             <div class="ls-placeholder-visual">
               <div class="ls-placeholder-icon"><i class="fas fa-inbox"></i></div>
             </div>
             <h3>Select a Conversation</h3>
             <p>Choose a user from the queue to begin providing support.</p>
           </div>
        </div>
        
        <div class="ls-admin-main" id="lsAdminHistoryArea" style="display: none; background: #ffffff;">
            <div class="ls-chat-header" style="background: #ffffff; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 1rem;">
              <button class="ls-mobile-back" onclick="chatInterface.hideAdminPreviousSessions()"><i class="fas fa-chevron-left"></i></button>
              <h3 style="margin: 0; font-size: 1.1rem; color: #111827;">Previous Sessions</h3>
            </div>
            <div class="ls-messages-scroll" id="lsAdminHistoryList" style="padding: 1rem;">
            </div>
        </div>

        <div class="ls-admin-main" id="lsAdminHistoryViewArea" style="display: none; background: #f9fafb;">
            <div class="ls-chat-header" style="background: #ffffff; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 1rem; z-index: 2;">
              <button class="ls-mobile-back" onclick="chatInterface.showAdminPreviousSessions()"><i class="fas fa-chevron-left"></i></button>
              <h3 style="margin: 0; font-size: 1.1rem; color: #111827;">Archived Transcript</h3>
            </div>
            <div class="ls-messages-scroll" id="lsAdminHistoryViewMessages">
            </div>
        </div>
      </div>
    `;
    this.refreshAdminLiveQueue();
    this.startLiveSupportPolling();
  }

  async refreshAdminLiveQueue() {
    try {
      const res = await fetch(`${this.API}/assistant/connections?admin_id=${this.user.user_id}&_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      const list = document.getElementById('lsAdminQueueList');
      const countEl = document.getElementById('lsQueueCount');
      if (!list) return;

      if (!data.connections || data.connections.length === 0) {
        list.innerHTML = `<div class="ls-empty-sidebar"><i class="fas fa-check-circle"></i><span>No active requests</span></div>`;
        if (countEl) countEl.textContent = '0 sessions';
        return;
      }

      if (countEl) countEl.textContent = `${data.connections.length} session${data.connections.length !== 1 ? 's' : ''}`;

      list.innerHTML = data.connections.map(conn => {
        const isActive = this.currentLiveSession?.id === conn.id;
        const isPending = conn.status === 'connecting';
        const initials = (conn.user_name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        const timeAgo = conn.created_at ? this.getRelativeTime(new Date(conn.created_at)) : '';
        return `
          <div class="ls-queue-item ${isActive ? 'active' : ''} ${isPending ? 'is-pending' : ''}" onclick="chatInterface.selectAdminLiveSession(${conn.id})">
            <div class="ls-queue-avatar-wrap">
              <div class="ls-queue-avatar-circle">${initials}</div>
              <span class="ls-queue-presence ${isPending ? 'pending' : 'active'}"></span>
            </div>
            <div class="ls-queue-info">
              <div class="ls-queue-top-row">
                <span class="ls-queue-name">${this.escapeHtml(conn.user_name || 'Unknown User')}</span>
                ${timeAgo ? `<span class="ls-queue-time">${timeAgo}</span>` : ''}
              </div>
              <div class="ls-queue-bottom-row">
                <span class="ls-queue-id">${this.escapeHtml(conn.user_id)}</span>
                <span class="ls-queue-status-tag ${isPending ? 'pending' : 'connected'}">${isPending ? 'Pending' : 'Active'}</span>
              </div>
            </div>
            <button class="ls-queue-delete-btn" onclick="chatInterface.handleDeleteSession(event, ${conn.id})" title="Remove Session">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.error('Failed to refresh queue', e);
    }
  }

  async handleDeleteSession(event, connectionId) {
    event.stopPropagation(); // Prevent opening the chat
    const btn = event.currentTarget;
    if (btn) {
      const item = btn.closest('.ls-queue-item');
      if (item) item.style.display = 'none'; // Optimistic hide
    }
    await this.endLiveSupport(connectionId);
  }

  async selectAdminLiveSession(connectionId) {
    try {
      const res = await fetch(`${this.API}/assistant/connections?admin_id=${this.user.user_id}&_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      this.currentLiveSession = data.connections.find(c => c.id === connectionId);
      this.refreshAdminLiveQueue();
      this.renderAdminChatArea();
      
      const layout = document.querySelector('.ls-admin-layout');
      if (layout) layout.classList.add('chat-active');
    } catch (e) {
      console.error(e);
    }
  }

  closeAdminChatMobile() {
    const layout = document.querySelector('.ls-admin-layout');
    if (layout) layout.classList.remove('chat-active');
  }

  renderAdminChatArea() {
    const chatArea = document.getElementById('lsAdminChatArea');
    if (!chatArea || !this.currentLiveSession) return;
    
    const isPending = this.currentLiveSession.status === 'connecting';
    const isConnected = this.currentLiveSession.status === 'connected';
    const initials = (this.currentLiveSession.user_name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    
    chatArea.innerHTML = `
      <div class="ls-chat-header">
        <div class="ls-agent-info">
          <button class="ls-mobile-back" style="display: none;" onclick="chatInterface.closeAdminChatMobile()">
            <i class="fas fa-chevron-left"></i>
          </button>
          <div class="ls-queue-avatar-wrap">
            <div class="ls-queue-avatar-circle">${initials}</div>
            <span class="ls-queue-presence ${isPending ? 'pending' : 'active'}"></span>
          </div>
          <div class="ls-agent-details">
            <h3>${this.escapeHtml(this.currentLiveSession.user_name || 'Unknown User')} <span class="ls-user-id-tag">${this.escapeHtml(this.currentLiveSession.user_id)}</span></h3>
            <span class="ls-status-badge ${isPending ? 'connecting' : 'connected'}">
              <span class="ls-dot ${isPending ? 'connecting' : 'green'}"></span> ${isPending ? 'Waiting for acceptance' : 'Connected'}
            </span>
          </div>
        </div>
        <div class="ls-header-actions">
           ${isPending ? 
             `<button class="ls-btn-accept" onclick="chatInterface.acceptLiveSupport(${this.currentLiveSession.id})"><i class="fas fa-check"></i> Accept</button>
              <button class="ls-btn-decline" onclick="chatInterface.declineLiveSupport(${this.currentLiveSession.id})"><i class="fas fa-xmark"></i> Decline</button>` : ''}
           ${isConnected ? 
             `<button class="ls-btn-end" onclick="chatInterface.endLiveSupport(${this.currentLiveSession.id})"><i class="fas fa-phone-slash"></i> End Chat</button>` : ''}
        </div>
      </div>
      
      <div class="ls-chat-interface" style="display: ${isConnected ? 'flex' : 'none'};">
        ${isConnected ? '<div class="ls-connected-banner"><div class="ls-connected-pulse"></div><i class="fas fa-shield-check"></i><span>Secure Bridge Active</span></div>' : ''}
        <div class="ls-messages-scroll" id="lsAdminMessages"></div>
        <div class="ls-chat-input-wrapper">
          <div class="ls-chat-input-container">
            <textarea id="lsAdminMsgInput" placeholder="Message User..." rows="1" onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); chatInterface.sendLiveMessage(); }"></textarea>
            <div class="ls-chat-input-actions" style="justify-content: flex-end;">
              <button class="ls-btn-submit" onclick="chatInterface.sendLiveMessage()">Send <i class="fas fa-paper-plane"></i></button>
            </div>
          </div>
        </div>
      </div>
      
      ${isPending ? `
        <div class="ls-chat-placeholder">
          <div class="ls-placeholder-visual">
            <div class="ls-placeholder-icon pending"><i class="fas fa-hourglass-half"></i></div>
          </div>
          <h3>Awaiting Response</h3>
          <p>This user is waiting for you to accept their support request.</p>
        </div>
      ` : ''}
    `;

    if (isConnected) {
      this.loadLiveMessages('lsAdminMessages');
    }
  }

  getRelativeTime(date) {
    if (!date || isNaN(date)) return '';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  async declineLiveSupport(connectionId) {
    try {
      if (this.currentLiveSession && this.currentLiveSession.id === connectionId) {
        this.currentLiveSession.status = 'disconnected';
        this.renderAdminChatArea();
      }
      await fetch(`${this.API}/assistant/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId })
      });
      // UI will update automatically via polling
    } catch (e) {
      this.showToast('Failed to decline', 'error');
    }
  }

  async acceptLiveSupport(connectionId) {
    try {
      if (this.currentLiveSession && this.currentLiveSession.id === connectionId) {
        this.currentLiveSession.status = 'connected';
        this.renderAdminChatArea();
      }
      await fetch(`${this.API}/assistant/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId, admin_id: this.user.user_id })
      });
      // UI will update automatically via polling
    } catch (e) {
      this.showToast('Failed to accept', 'error');
    }
  }

  async endLiveSupport(connectionId) {
    try {
      if (this.currentLiveSession && this.currentLiveSession.id === connectionId) {
        this.currentLiveSession.status = 'disconnected';
        this.renderAdminChatArea();
      }
      await fetch(`${this.API}/assistant/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId })
      });
    } catch (e) {
      this.showToast('Failed to end session', 'error');
    }
  }

  // ==========================================
  // LIVE SUPPORT - REACTIVE EVENT LISTENER
  // ==========================================
  
  setupReactiveLiveSupport() {
    window.addEventListener('SupportBridgeStateChanged', (e) => {
      const data = e.detail;
      
      // Remove AI Tab Badge (Disabled per user request)
      const tabBtn = document.querySelector('.tab-btn[data-tab="assistant"]');
      if (tabBtn) {
        let badge = tabBtn.querySelector('.support-badge');
        if (badge) {
          badge.style.display = 'none';
        }
      }
      
      // Keep track of session state for meta display even if we aren't in live support view
      if (this.assistantConnectionState !== 'live_support_view') {
        if (data.status === 'connected' || data.status === 'connecting') {
           this.currentLiveSession = { id: data.connection_id, status: data.status };
           if (this.activeTab === 'assistant') {
             this.renderAssistant();
           }
        } else {
           this.currentLiveSession = null;
           if (this.activeTab === 'assistant') {
             this.renderAssistant();
           }
        }
        return;
      }
      
      if (this.isAdmin) {
        this.refreshAdminLiveQueue();
        if (this.currentLiveSession?.status === 'connected') this.loadLiveMessages('lsAdminMessages');
      } else {
        // Faculty UI reactive update
        const newStatus = data.status || 'disconnected';
        
        if (!this.currentLiveSession && (!newStatus || newStatus === 'disconnected')) {
            return; // No session and no new session — nothing to update
        }

        // Anti-Jitter: Ignore 'disconnected' from polling if we are currently 'connecting' optimistically.
        // This prevents the UI from flashing back to 'CONNECT' if a background poll races the POST request.
        if (this.currentLiveSession?.status === 'connecting' && newStatus === 'disconnected') {
            return;
        }

        if (this.currentLiveSession?.status !== newStatus || this.currentLiveSession?.id !== data.connection_id) {
            if (newStatus !== 'disconnected') {
                this.currentLiveSession = { id: data.connection_id, status: newStatus };
            } else {
                this.currentLiveSession = null;
            }
            this.updateUserLiveSupportUI();
        }
        if (this.currentLiveSession?.status === 'connected') this.loadLiveMessages('lsUserMessages');
      }
    });
  }

  // ==========================================
  // LIVE SUPPORT - SHARED CHAT MECHANICS
  // ==========================================
  
  async loadLiveMessages(containerId) {
    if (!this.currentLiveSession) return;
    try {
      const res = await fetch(`${this.API}/assistant/messages/${this.currentLiveSession.id}?reader_id=${this.user.user_id}`);
      const data = await res.json();
      const container = document.getElementById(containerId);
      if (!container) return;

      if (!data.messages || data.messages.length === 0) {
        container.innerHTML = `<div class="ls-empty-chat">No messages yet. Say hello!</div>`;
        return;
      }

      container.innerHTML = data.messages.map(msg => {
        const isMe = String(msg.sender_id) === String(this.user.user_id);
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const name = isMe ? 'You' : (this.isAdmin ? (this.currentLiveSession.user_name || 'User') : 'Support Agent');
        
        let avatarIcon;
        if (isMe) {
          avatarIcon = this.isAdmin ? '<i class="fas fa-shield-halved"></i>' : '<i class="fas fa-user"></i>';
        } else {
          avatarIcon = this.isAdmin ? '<i class="fas fa-user"></i>' : '<i class="fas fa-shield-halved"></i>';
        }

        return `
          <div class="ls-msg-row ${isMe ? 'me' : 'them'}">
            <div class="ls-msg-avatar">
              ${avatarIcon}
            </div>
            <div class="ls-msg-content">
              <div class="ls-msg-header">
                <span class="ls-msg-name">${this.escapeHtml(name)}</span>
                <span class="ls-msg-time">${time}</span>
              </div>
              <div class="ls-msg-body">
                <p>${this.escapeHtml(msg.content)}</p>
              </div>
            </div>
          </div>
        `;
      }).join('');
      
      container.scrollTop = container.scrollHeight;
    } catch (e) {
      console.error(e);
    }
  }

  async sendLiveMessage() {
    const inputId = this.isAdmin ? 'lsAdminMsgInput' : 'lsUserMsgInput';
    const containerId = this.isAdmin ? 'lsAdminMessages' : 'lsUserMessages';
    const input = document.getElementById(inputId);
    const content = input?.value.trim();
    if (!content || !this.currentLiveSession) return;

    input.value = '';
    try {
      await fetch(`${this.API}/assistant/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_id: this.currentLiveSession.id,
          sender_id: this.user.user_id,
          content: content
        })
      });
      this.loadLiveMessages(containerId);
    } catch (e) {
      this.showToast('Failed to send message', 'error');
    }
  }

  startLiveSupportPolling() {
    // Deprecated: Handled by MessagingSystem's SupportBridgeStateChanged event
  }

  getAssistantCatalog() {
    return ASSISTANT_KNOWLEDGE_BASE;
  }

  getAssistantCategory(categoryKey) {
    return this.getAssistantCatalog().find((category) => category.key === categoryKey) || null;
  }

  getAssistantConnectionMeta() {
    if (this.assistantConnectionState === 'connecting') {
      return {
        title: this.isAdmin ? 'Connecting to users...' : 'Connecting to the real assistant',
        description: this.isAdmin ? 'Waiting for users to connect.' : 'The bridge is being prepared. Local knowledge stays active.',
        buttonLabel: 'Connecting…',
        statusText: 'Wait, connecting...'
      };
    }

    if (this.assistantConnectionState === 'connected') {
      return {
        title: this.isAdmin ? 'Live Support Active' : 'Real assistant bridge ready',
        description: 'Live responses can be used when available.',
        buttonLabel: 'Connected',
        statusText: 'Connected to the live bridge.'
      };
    }

    return {
      title: this.isAdmin ? 'Live Support Queue' : 'Local knowledge engine ready',
      description: this.isAdmin ? 'Answer real-time questions from faculty who request live support.' : 'This assistant already answers from the project itself: flows, screens, endpoints, and support topics are preloaded.',
      buttonLabel: this.isAdmin ? 'Connect with the Users' : 'Connect with the Support Bridge',
      statusText: this.isAdmin ? 'Open the queue to accept incoming live support chats.' : 'Local knowledge is ready. Connect the live bridge when you want handoff support.'
    };
  }

  normalizeAssistantText(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  trimAssistantAnswer(answer, maxLength = 120) {
    const text = String(answer || '').trim().replace(/\s+/g, ' ');
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
  }

  scrollAssistantMessages() {
    const messagesDiv = document.getElementById('aiMessages');
    if (messagesDiv) {
      messagesDiv.scrollTo({ top: messagesDiv.scrollHeight, behavior: 'smooth' });
    }
  }

  getAssistantTopicMatch(question) {
    const normalized = this.normalizeAssistantText(question);
    let bestMatch = null;

    this.getAssistantCatalog().forEach((category) => {
      category.topics.forEach((topic) => {
        let score = 0;

        if (normalized.includes(this.normalizeAssistantText(topic.title))) score += 8;
        topic.keywords.forEach((keyword) => {
          const normalizedKeyword = this.normalizeAssistantText(keyword);
          if (normalized.includes(normalizedKeyword)) score += Math.max(2, normalizedKeyword.split(' ').length);
        });

        category.keywords.forEach((keyword) => {
          const normalizedKeyword = this.normalizeAssistantText(keyword);
          if (normalized.includes(normalizedKeyword)) score += 1;
        });

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { category, topic, score };
        }
      });
    });

    return bestMatch;
  }

  getAssistantCategoryOverview(category) {
    const topicTitles = category.topics.slice(0, 3).map((topic) => topic.title.replace(/^How do I\s+/i, '').replace(/^What if I\s+/i, '')).join(' • ');
    return {
      answer: `This section covers ${category.title.toLowerCase()}. Try one of these: ${topicTitles}. If you want, ask a fuller question and I will turn it into the exact app flow instead of a generic help response.`,
      sourceLabel: `Local knowledge • ${category.title}`
    };
  }

  getLocalAssistantResponse(question) {
    const match = this.getAssistantTopicMatch(question);
    if (match && match.score >= 3) {
      return {
        answer: match.topic.answer,
        sourceLabel: `Local knowledge • ${match.category.title}`,
        category: match.category.key,
        topic: match.topic.title
      };
    }

    const normalized = this.normalizeAssistantText(question);
    const activeCategory = this.getAssistantCategory(this.assistantActiveCategory);
    const category = this.getAssistantCatalog().find((item) =>
      item.keywords.some((keyword) => normalized.includes(this.normalizeAssistantText(keyword)))
    ) || ((normalized.split(' ').filter(Boolean).length <= 3) ? activeCategory : null);

    if (category) {
      const overview = this.getAssistantCategoryOverview(category);
      return {
        answer: overview.answer,
        sourceLabel: overview.sourceLabel,
        category: category.key,
        topic: 'Overview'
      };
    }

    return {
      answer: `I can cover login, face scan, attendance, leave, staff admin, reports, alerts, troubleshooting, and the app architecture itself. Click a topic card or ask something like “How does the staff directory work?” or “What happens after face scan?” and I’ll answer in project terms.`,
      sourceLabel: 'Local knowledge',
      category: 'general',
      topic: 'General help'
    };
  }

  async tryLiveAssistantResponse(question) {
    if (this.assistantConnectionState !== 'connected') return null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const response = await fetch(`${this.API}/assistant/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: this.user.user_id, query: question }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) return null;

      const data = await response.json();
      const answer = String(data?.response || '').trim();
      if (!answer) return null;

      return {
        answer,
        sourceLabel: 'Real assistant bridge',
        category: 'Live',
        topic: 'Live response'
      };
    } catch (error) {
      return null;
    }
  }

  async getAssistantResponse(question) {
    const liveResponse = await this.tryLiveAssistantResponse(question);
    if (liveResponse) return liveResponse;
    return this.getLocalAssistantResponse(question);
  }

  renderBroadcast() {
    if (!this.isAdmin) return;

    const convList = document.getElementById('convList');
    convList.innerHTML = `
      <div class="broadcast-tips">
        <h4>Broadcast Control</h4>
        <p>Send one alert, track it centrally, and remove it for everyone if needed.</p>
      </div>
    `;

    const chatArea = document.getElementById('chatArea');
    chatArea.innerHTML = `
      <div class="broadcast-shell">
        <div class="broadcast-hero">
          <span class="broadcast-kicker">Admin broadcast</span>
          <h3>Send alert to faculty</h3>
          <p>Compose once, select recipients, and keep a mirrored admin copy so the alert can be removed for the whole college later.</p>
        </div>
        <div class="broadcast-form">
        <div class="form-group">
          <label>Priority Level</label>
          <div class="priority-selector">
            <button class="priority-btn info active" data-priority="info" onclick="chatInterface.selectPriority('info', this)">
              Info ℹ️
            </button>
            <button class="priority-btn warning" data-priority="warning" onclick="chatInterface.selectPriority('warning', this)">
              Warning ⚠️
            </button>
            <button class="priority-btn critical" data-priority="critical" onclick="chatInterface.selectPriority('critical', this)">
              Critical 🚨
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>Title</label>
          <input type="text" id="alertTitle" placeholder="Alert title" class="input-field" maxlength="100">
        </div>
        <div class="form-group">
          <label>Message</label>
          <textarea id="alertMessage" placeholder="Write your message here…" class="message-input" rows="5" maxlength="500"></textarea>
          <div class="char-counter"><span id="broadcastCharCount">0</span> / 500</div>
        </div>
        <div class="form-group">
          <label>Recipients</label>
          <input type="text" id="recipientSearchInput" placeholder="Search by ID or name" class="input-field">
          <div class="recipient-toolbar">
            <span class="recipient-selection-summary" id="recipientSelectionSummary">0 selected</span>
            <button type="button" class="recipient-toolbar-btn" onclick="chatInterface.selectAllRecipients()">
              <i class="fas fa-check-double"></i>
              <span>Select All</span>
            </button>
          </div>
          <div class="recipients-list" id="recipientsList">
            <div class="loading">Loading faculty...</div>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn-primary" onclick="chatInterface.sendBroadcast()">
            <i class="fas fa-paper-plane"></i> Send Alert
          </button>
        </div>
        </div>
      </div>
    `;

    this.loadBroadcastRecipients();

    const alertMessage = document.getElementById('alertMessage');
    const charCount = document.getElementById('broadcastCharCount');
    if (alertMessage && charCount) {
      alertMessage.addEventListener('input', () => {
        charCount.textContent = alertMessage.value.length;
      });
    }

    const recipientSearchInput = document.getElementById('recipientSearchInput');
    if (recipientSearchInput) {
      recipientSearchInput.addEventListener('input', (e) => {
        this.renderBroadcastRecipients(e.target.value.trim().toLowerCase());
      });
    }
  }

  selectPriority(priority, btn) {
    this.selectedAlertPriority = priority;
    document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  async loadBroadcastRecipients() {
    try {
      const res = await fetch(`${this.API}/users/faculty`);
      const data = await res.json();
      this.broadcastRecipients = data.faculty || [];
      this.renderBroadcastRecipients('');
      this.updateBroadcastSelectionSummary();
    } catch (err) {
      console.error('Failed to load recipients:', err);
      document.getElementById('recipientsList').innerHTML = '<div class="error">Failed to load faculty</div>';
    }
  }

  renderBroadcastRecipients(query = '') {
    const list = document.getElementById('recipientsList');
    if (!list) return;

    const normalized = String(query || '').toLowerCase();
    const filtered = normalized
      ? this.broadcastRecipients.filter(f =>
          String(f.user_id || '').toLowerCase().includes(normalized) ||
          String(f.name || '').toLowerCase().includes(normalized)
        )
      : this.broadcastRecipients.slice();

    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state"><p>No matching recipients</p></div>';
      this.updateBroadcastSelectionSummary();
      return;
    }

    list.innerHTML = filtered.map(f => {
      const checked = this.broadcastSelectedRecipients.has(f.user_id) ? 'checked' : '';
      return `
        <label class="recipient-item">
          <input type="checkbox" class="recipient-cb" value="${f.user_id}" data-name="${this.escapeHtml(f.name)}" ${checked}>
          <span class="recipient-name">${this.escapeHtml(f.name)}</span>
          <span class="recipient-id">${this.escapeHtml(f.user_id)}</span>
        </label>
      `;
    }).join('');

    list.querySelectorAll('.recipient-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) this.broadcastSelectedRecipients.add(cb.value);
        else this.broadcastSelectedRecipients.delete(cb.value);
        this.updateBroadcastSelectionSummary();
      });
    });

    this.updateBroadcastSelectionSummary();
  }

  selectAllRecipients() {
    const searchInput = document.getElementById('recipientSearchInput');
    const query = String(searchInput?.value || '').trim().toLowerCase();
    const filtered = query
      ? this.broadcastRecipients.filter(f =>
          String(f.user_id || '').toLowerCase().includes(query) ||
          String(f.name || '').toLowerCase().includes(query)
        )
      : this.broadcastRecipients.slice();

    if (!filtered.length) {
      this.showToast('No faculty available to select', 'info');
      return;
    }

    const shouldSelectAll = filtered.some(f => !this.broadcastSelectedRecipients.has(f.user_id));
    filtered.forEach(f => {
      if (shouldSelectAll) this.broadcastSelectedRecipients.add(f.user_id);
      else this.broadcastSelectedRecipients.delete(f.user_id);
    });

    this.renderBroadcastRecipients(query);
    this.showToast(shouldSelectAll ? 'All visible faculty selected' : 'Visible faculty cleared', 'success');
  }

  updateBroadcastSelectionSummary() {
    const summary = document.getElementById('recipientSelectionSummary');
    if (!summary) return;
    const total = this.broadcastRecipients.length;
    const selected = this.broadcastSelectedRecipients.size;
    summary.textContent = `${selected} selected${total ? ` of ${total}` : ''}`;
  }

  async sendBroadcast() {
    const title = document.getElementById('alertTitle')?.value?.trim();
    const message = document.getElementById('alertMessage')?.value?.trim();
    const selected = Array.from(this.broadcastSelectedRecipients);

    if (!title || !message || !selected.length) {
      this.showToast('Please fill all fields and select recipients', 'error');
      return;
    }

    try {
      const relatedId = `broadcast:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const recipientResponses = await Promise.all(selected.map(recipientId =>
        fetch(`${this.API}/admin/alerts/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender_id: this.user.user_id,
            recipient_id: recipientId,
            title: title,
            content: message,
            priority: this.selectedAlertPriority,
            related_id: relatedId
          })
        })
      ));
      if (recipientResponses.some((res) => !res.ok)) throw new Error('Failed');

      const adminMirrorResponse = await fetch(`${this.API}/admin/alerts/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: this.user.user_id,
          recipient_id: this.user.user_id,
          title,
          content: message,
          priority: this.selectedAlertPriority,
          related_id: relatedId
        })
      });
      if (!adminMirrorResponse.ok) throw new Error('Failed');

      document.getElementById('alertTitle').value = '';
      document.getElementById('alertMessage').value = '';
      this.broadcastSelectedRecipients.clear();
      const searchInput = document.getElementById('recipientSearchInput');
      if (searchInput) searchInput.value = '';
      this.renderBroadcastRecipients('');
      this.updateBroadcastSelectionSummary();

      this.showToast(`Alert sent to ${selected.length} recipient${selected.length > 1 ? 's' : ''}`, 'success');

      this.activeTab = 'alerts';
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === 'alerts');
      });
      this.switchTab('alerts');
    } catch (err) {
      console.error('Failed to send broadcast:', err);
      this.showToast('Failed to send alert', 'error');
    }
  }

  async startConversation(userId) {
    const normalizedId = String(userId || '').trim();
    const selected = this.selectedUserForNewConversation;
    const selectedName = (selected && String(selected.user_id) === normalizedId) ? selected.name : null;
    const fallbackUser = (this.allUsers || []).find(u => String(u.user_id) === normalizedId);
    const userName = selectedName || fallbackUser?.name || normalizedId;

    this.conversations[normalizedId] = {
      id: normalizedId,
      name: userName,
      role: selected?.role || fallbackUser?.role || null,
      messages: [],
      unread: 0,
      lastMessage: null,
      lastTime: null
    };
    
    this.hideAllModals();
    document.getElementById('userIdInput').value = '';
    this.selectedUserForNewConversation = null;
    
    this.openConversation(normalizedId, userName);
    this.renderConversations();
  }

  // Utility Methods
  getColorForUser(userId) {
    const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#0EA5E9', '#14B8A6'];
    const id = String(userId || 'unknown');
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  getInitials(name) {
    return String(name || '?')
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getFirstName() {
    return this.user.name?.split(' ')[0] || 'there';
  }

  canRequestPermission() {
    if (this.assistantConnectionState === 'live_support_view' && this.currentLiveSession?.status === 'connected') {
        return this.user?.role === 'faculty';
    }
    return this.user?.role === 'faculty' && String(this.currentChatUserRole || '').toLowerCase() === 'admin';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  formatTime(timestamp) {
    const date = this.parseTimestamp(timestamp);
    if (!timestamp || Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString();
  }

  formatMessageTime(timestamp) {
    const date = this.parseTimestamp(timestamp);
    if (!timestamp || Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatDateLabel(timestamp) {
    const date = this.parseTimestamp(timestamp);
    if (!timestamp || Number.isNaN(date.getTime())) return 'Unknown';
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    if (date > weekAgo) return date.toLocaleDateString([], { weekday: 'long' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getPriorityColor(priority) {
    const colors = {
      critical: '#EF4444',
      warning: '#F59E0B',
      info: '#3B82F6'
    };
    return colors[priority] || colors.info;
  }

  normalizePriority(priority) {
    const raw = String(priority || '').toLowerCase();
    if (raw.includes('critical') || raw.includes('danger') || raw.includes('urgent')) return 'critical';
    if (raw.includes('warning') || raw.includes('warn')) return 'warning';
    return 'info';
  }

  priorityRank(priority) {
    const p = this.normalizePriority(priority);
    if (p === 'critical') return 0;
    if (p === 'warning') return 1;
    return 2;
  }

  getMessageTimestamp(msg) {
    if (!msg) return null;
    return msg.timestamp || msg.created_at || msg.time || null;
  }

  parseTimestamp(ts) {
    if (!ts) return new Date(0);
    if (typeof ts === 'string') {
      const hasZone = /Z$|[+-]\d{2}:?\d{2}$/.test(ts);
      const normalized = hasZone ? ts : `${ts}Z`;
      const parsed = new Date(normalized);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const parsed = new Date(ts);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }

  getMessageDate(msg) {
    const ts = this.getMessageTimestamp(msg);
    return this.parseTimestamp(ts);
  }

  getDefaultAIResponse(question) {
    const lq = question.toLowerCase();
    if (lq.includes('check')) return 'To check in, tap the Face Scan button on your dashboard, ensure you\'re within campus bounds, and hold your face steady for 2-3 seconds.';
    if (lq.includes('late')) return 'Late arrivals are marked if you check in more than 15 minutes after your scheduled time. You can request a late permission through the dashboard.';
    if (lq.includes('leave')) return 'To apply for leave, go to Leave Management on your dashboard, select the type and dates, add a reason, and submit for admin approval.';
    if (lq.includes('stat')) return 'Your attendance statistics are on your Personal Dashboard, including present days, lates, early exits, and monthly summaries.';
    return 'That\'s a great question! For more detailed information, please contact your administrator through the Messages tab.';
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }, 10);
  }

  // Permission Request Wizard Methods
  showPermissionRequestModal() {
    if (!this.canRequestPermission()) {
      this.showToast('Permission requests are only available in faculty-to-admin chats.', 'error');
      return;
    }
    this.showModal('permissionRequestModal');
    
    // Initialize Wizard State
    this.currentWizardStep = 1;
    this.selectedWizardCategory = null;
    this.selectedWizardType = null;
    
    this.attachPermissionFormListeners();
    this.resetPermissionRequestForm();
    this.renderWizardCategories();
    this.updateWizardUI();
  }

  attachPermissionFormListeners() {
    const form = document.getElementById('permissionForm');
    const permissionFullDay = document.getElementById('permissionFullDay');
    const fileInput = document.getElementById('permissionDocument');
    const fileName = document.getElementById('fileName');
    const btnSubmit = document.getElementById('btnSubmitPermission');
    const customType = document.getElementById('customType');

    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    if (permissionFullDay) {
      permissionFullDay.addEventListener('change', () => this.syncPermissionRequestUi());
    }

    if (customType) {
      customType.addEventListener('input', () => this.syncPermissionRequestUi());
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (fileName) {
          fileName.textContent = file ? `[Attached] ${file.name}` : '';
          fileName.style.display = file ? 'inline-block' : 'none';
        }
      });
    }

    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => this.submitPermissionRequest());
    }
  }

  updateWizardUI() {
    // Update steps visibility
    document.querySelectorAll('.wizard-step').forEach((el, index) => {
      const stepNum = index + 1;
      if (stepNum === this.currentWizardStep) {
        el.style.display = 'block';
        setTimeout(() => el.classList.add('active'), 10);
      } else {
        el.classList.remove('active');
        setTimeout(() => { if(!el.classList.contains('active')) el.style.display = 'none'; }, 300);
      }
    });

    // Update progress dots
    document.querySelectorAll('.wizard-step-dot').forEach((el, index) => {
      el.classList.toggle('active', index + 1 === this.currentWizardStep);
      el.classList.toggle('completed', index + 1 < this.currentWizardStep);
    });

    // Update footer buttons
    const btnBack = document.getElementById('btnWizardBack');
    const btnNext = document.getElementById('btnWizardNext');
    const btnSubmit = document.getElementById('btnSubmitPermission');

    if (btnBack) btnBack.style.display = this.currentWizardStep > 1 ? 'block' : 'none';
    if (btnNext) btnNext.style.display = 'none'; // We advance automatically on selection for steps 1 and 2
    if (btnSubmit) btnSubmit.style.display = this.currentWizardStep === 3 ? 'block' : 'none';
  }

  wizardBack() {
    if (this.currentWizardStep > 1) {
      this.currentWizardStep--;
      this.updateWizardUI();
    }
  }

  renderWizardCategories() {
    const grid = document.getElementById('wizardCategoryGrid');
    if (!grid) return;

    grid.innerHTML = FACULTY_PERMISSION_SECTIONS.map((section, index) => `
      <div class="wizard-category-card" onclick="chatInterface.selectWizardCategory(${index})">
        <div class="category-icon"><i class="fas ${index === 0 ? 'fa-sliders' : index === 1 ? 'fa-calendar-day' : 'fa-triangle-exclamation'}"></i></div>
        <div class="category-info">
          <h5>${this.escapeHtml(section.title)}</h5>
          <p>${this.escapeHtml(section.description)}</p>
        </div>
        <div class="category-arrow"><i class="fas fa-chevron-right"></i></div>
      </div>
    `).join('');
  }

  selectWizardCategory(index) {
    this.selectedWizardCategory = FACULTY_PERMISSION_SECTIONS[index];
    this.renderWizardTypes();
    this.currentWizardStep = 2;
    this.updateWizardUI();
  }

  renderWizardTypes() {
    const grid = document.getElementById('wizardTypeGrid');
    if (!grid || !this.selectedWizardCategory) return;

    grid.innerHTML = this.selectedWizardCategory.types.map((type) => {
      const preset = FACULTY_PERMISSION_PRESETS[type] || FACULTY_PERMISSION_PRESETS.custom;
      return `
        <div class="wizard-type-card" onclick="chatInterface.selectWizardType('${type}')">
          <div class="type-icon"><i class="fas ${preset.icon}"></i></div>
          <div class="type-info" style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom: 3px;">
              <strong>${this.escapeHtml(preset.label)}</strong>
              <span style="font-size:0.62rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; background:rgba(59,91,219,0.08); color:#3B5BDB; padding:2px 7px; border-radius:999px; flex-shrink:0;">${this.escapeHtml(preset.category)}</span>
            </div>
            <p>${this.escapeHtml(preset.description)}</p>
          </div>
          <i class="fas fa-chevron-right" style="color:#cbd5e1; flex-shrink:0; font-size:0.8rem; align-self:center;"></i>
        </div>
      `;
    }).join('');
  }

  selectWizardType(type) {
    this.selectedWizardType = type;
    const typeInput = document.getElementById('permissionType');
    if (typeInput) typeInput.value = type;
    
    this.renderWizardBenefits(type);
    
    // Set form defaults
    const preset = FACULTY_PERMISSION_PRESETS[type] || FACULTY_PERMISSION_PRESETS.custom;
    const fullDayInput = document.getElementById('permissionFullDay');
    const startTime = document.getElementById('startTime');
    const endTime = document.getElementById('endTime');

    if (fullDayInput) fullDayInput.checked = Boolean(preset.defaultFullDay);
    if (startTime && preset.defaultStartTime) startTime.value = preset.defaultStartTime;
    if (endTime && preset.defaultEndTime) endTime.value = preset.defaultEndTime;

    this.syncPermissionRequestUi();
    
    this.currentWizardStep = 3;
    this.updateWizardUI();
  }

  renderWizardBenefits(type) {
    const preset = FACULTY_PERMISSION_PRESETS[type] || FACULTY_PERMISSION_PRESETS.custom;
    const title = document.getElementById('benefitTitle');
    const hint = document.getElementById('benefitHint');
    const scope = document.getElementById('benefitScope');
    const evidence = document.getElementById('benefitEvidence');
    
    const fullDay = Boolean(document.getElementById('permissionFullDay')?.checked);
    
    // Parse time to 12-hour format if available for friendlier display
    const startTimeRaw = document.getElementById('startTime')?.value || '09:00';
    const endTimeRaw = document.getElementById('endTime')?.value || '17:00';
    
    let whatHappens = '';
    if (type === 'late_arrival') {
        whatHappens = `If approved, you may check in until <b>${endTimeRaw}</b>. Evening checkout is still required.`;
    } else if (type === 'early_departure') {
        whatHappens = `If approved, you may check out from <b>${startTimeRaw}</b>. Morning check-in is still required.`;
    } else if (type === 'extended_campus_exit') {
        whatHappens = `If approved, the Outside Campus restriction is suspended from <b>${startTimeRaw}</b> until <b>${endTimeRaw}</b>.`;
    } else if (type === 'half_day_morning') {
        whatHappens = `If approved, morning attendance is waived. Evening checkout is still required.`;
    } else if (type === 'half_day_afternoon') {
        whatHappens = `If approved, afternoon attendance is waived. Morning check-in is still required.`;
    } else if (type === 'work_from_home') {
        whatHappens = `If approved, you must still mark attendance via the app, but location checks are bypassed.`;
    } else if (type === 'full_day_absence' || type === 'medical_leave' || type === 'emergency') {
        whatHappens = `If approved, you do not need to mark attendance for the day.`;
    } else {
        whatHappens = `If approved, your attendance rules will be relaxed based on the admin's decision.`;
    }

    if (title) title.textContent = preset.label;
    if (hint) hint.innerHTML = `
      <span style="display:block; margin-bottom: 6px;">${this.escapeHtml(preset.hint)}</span>
      <div style="margin-top: 8px; background: #eff6ff; border-left: 3px solid #3b82f6; padding: 8px 12px; border-radius: 6px;">
        <span style="display:block; font-size: 0.75rem; color: #1e3a8a; font-weight: 700; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px;"><i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 4px;"></i> What happens if approved?</span>
        <span style="display:block; font-size: 0.85rem; color: #1e40af; line-height: 1.4;">${whatHappens}</span>
      </div>
      ${preset.effect ? `<span style="display:block; font-size: 0.75rem; color: #1d4ed8; font-weight: 600; background: rgba(59,91,219,0.06); padding: 6px 10px; border-radius: 6px; margin-top: 8px;"><i class="fas fa-check-circle" style="margin-right: 5px;"></i>${this.escapeHtml(preset.effect)}</span>` : ''}
    `;
    if (scope) scope.innerHTML = `<i class="fas fa-clock"></i> ${fullDay ? 'Full day impact' : (preset.showTimeRange ? 'Time window impact' : 'Single event impact')}`;
    if (evidence) evidence.innerHTML = `<i class="fas fa-file-shield"></i> ${this.escapeHtml(preset.evidence)}`;
  }

  syncPermissionRequestUi() {
    const type = document.getElementById('permissionType')?.value || 'late_arrival';
    const preset = FACULTY_PERMISSION_PRESETS[type] || FACULTY_PERMISSION_PRESETS.custom;
    
    const customTypeGroup = document.getElementById('customTypeGroup');
    const customDaysGroup = document.getElementById('customDaysGroup');
    const timeRangeGroup = document.getElementById('timeRangeGroup');
    const permissionFullDay = document.getElementById('permissionFullDay');
    const fullDay = Boolean(permissionFullDay?.checked);

    if (customTypeGroup) customTypeGroup.style.display = type === 'custom' ? 'block' : 'none';
    if (customDaysGroup) customDaysGroup.style.display = type === 'custom' ? 'block' : 'none';
    if (timeRangeGroup) timeRangeGroup.style.display = preset.showTimeRange && !fullDay ? 'block' : 'none';

    this.renderWizardBenefits(type);
  }

  resetPermissionRequestForm() {
    const form = document.getElementById('permissionForm');
    if (form) form.reset();

    const dateInput = document.getElementById('permissionDate');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
      dateInput.min = today;
    }

    const fileName = document.getElementById('fileName');
    if (fileName) {
      fileName.textContent = '';
      fileName.style.display = 'none';
    }
    
    this.currentWizardStep = 1;
    this.updateWizardUI();
  }

  getPermissionPreset(type) {
    return FACULTY_PERMISSION_PRESETS[type] || FACULTY_PERMISSION_PRESETS.custom;
  }

  buildPermissionMessageContent({ permissionType, customType, customDaysCount, permissionDate, startTime, endTime, reason, fullDay, hasDocument, attachmentUrl, permissionId }) {
    const preset = this.getPermissionPreset(permissionType);
    const title = permissionType === 'custom' && customType ? customType : preset.label;
    const lines = [
      'Permission Request',
      `Type: ${title}`,
      `Date: ${permissionDate}`,
      `Scope: ${fullDay ? 'Full day' : preset.requestLabel}`
    ];

    if (!fullDay && preset.showTimeRange && (startTime || endTime)) {
      lines.push(`Time: ${(startTime || '--:--')} to ${(endTime || '--:--')}`);
    }

    if (permissionType === 'custom' && customDaysCount) {
      lines.push(`Days: ${customDaysCount}`);
    }

    lines.push(`Policy hint: ${preset.hint}`);
    lines.push(`Reason: ${reason}`);
    lines.push(`Proof: ${hasDocument ? 'Attached' : 'Not attached'}`);
    if (attachmentUrl) {
      lines.push(`Attachment: ${attachmentUrl}`);
    }
    lines.push('Status: Pending');
    if (permissionId) {
      lines.push(`[PermissionID: ${permissionId}]`);
    }
    return lines.join('\n');
  }

  parsePermissionMessageContent(content) {
    const parsed = {};
    String(content || '').split('\n').forEach((line) => {
      const trimmed = line.trim();
      const idx = trimmed.indexOf(':');
      if (idx === -1) return;
      let key = trimmed.slice(0, idx).trim().toLowerCase();
      let value = trimmed.slice(idx + 1).trim();
      
      // Handle [PermissionID: 123] format
      if (key === '[permissionid') {
        key = 'permissionid';
        if (value.endsWith(']')) value = value.slice(0, -1);
      }
      
      parsed[key] = value;
    });
    return parsed;
  }

  getPermissionStatusClass(status) {
    const normalized = String(status || 'pending').trim().toLowerCase();
    if (normalized.includes('approved')) return 'approved';
    if (normalized.includes('rejected')) return 'rejected';
    return 'pending';
  }

  renderPermissionRequestCard(msg, isSent) {
    const data = this.parsePermissionMessageContent(msg.content);
    const status = data.status || 'Pending';
    const statusClass = this.getPermissionStatusClass(status);
    
    let isTrackingValid = false;
    if (data.date && data.date !== '-') {
      const pDate = new Date(data.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      isTrackingValid = pDate >= today;
    } else {
      isTrackingValid = true;
    }
    
    const detailRows = [
      ['Date', data.date || '-']
    ];
    if (data.scope && data.scope !== '-') detailRows.push(['Scope', data.scope]);
    detailRows.push(['Window', data.time || 'As requested']);
    detailRows.push(['Proof', data.proof || 'Not specified']);
    const policyHint = data['policy hint'] || '';
    const reason = data.reason || '';
    const days = data.days || '';
    const attachment = data.attachment || data['attachment url'] || data.proof || '';

    return `
      <div class="message-group ${isSent ? 'sent' : 'received'}">
        ${!isSent ? `<div class="message-avatar" style="background: ${this.getColorForUser(msg.sender_id)}">${this.getInitials(msg.sender_name || msg.sender_id)}</div>` : ''}
        <div class="message-bubble permission-request-bubble">
          <div class="permission-request-header">
            <div>
              <span class="permission-request-eyebrow">Exception proposal</span>
              <span class="permission-request-title">${this.escapeHtml(data.type || 'Permission Request')}</span>
            </div>
            <span class="permission-status-badge ${statusClass}">${this.escapeHtml(status)}</span>
          </div>
          <div class="permission-request-content">
            ${policyHint ? `<p class="permission-request-hint">${this.escapeHtml(policyHint)}</p>` : ''}
            <div class="permission-request-grid">
              ${detailRows.map(([label, value]) => `
                <div class="permission-detail-card">
                  <span>${this.escapeHtml(label)}</span>
                  <strong>${this.escapeHtml(value)}</strong>
                </div>
              `).join('')}
            </div>
            ${reason ? `
              <div class="permission-detail-card" style="margin-top: 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; width: 100%;">
                <span>Reason</span>
                <strong style="white-space: pre-wrap;">${this.escapeHtml(reason)}</strong>
              </div>
            ` : ''}
            ${days ? `<p class="permission-request-note"><strong>Days:</strong> ${this.escapeHtml(days)}</p>` : ''}
            ${attachment && attachment !== 'Not attached' ? `
              <p class="permission-request-note">
                <strong>Proof:</strong>
                <a class="permission-proof-link" href="${this.escapeHtml(attachment)}" target="_blank" rel="noopener noreferrer">Open attached file</a>
              </p>
            ` : ''}
            ${data['admin notes'] ? `<p class="permission-request-note"><strong>Admin notes:</strong> ${this.escapeHtml(data['admin notes'])}</p>` : ''}
            
            <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
              ${(msg.sender_id === this.user.user_id && data.permissionid && isTrackingValid) ? `<button onclick="window.chatInterface.openPermissionTimeline(${data.permissionid})" style="flex: 1; padding: 0.5rem; background: #f1f5f9; color: #3b82f6; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s;"><i class="fas fa-route"></i> Track Status</button>` : ''}
              
              ${(this.user.role === 'admin' && data.permissionid) ? (
                status.toLowerCase() === 'pending' ?
                  `<button onclick="window.chatInterface.openReviewModalFromChat('${data.permissionid}', '${encodeURIComponent(JSON.stringify(data))}', this)" style="flex: 1; padding: 0.5rem; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s;"><i class="fas fa-check"></i> Approve</button>` :
                status.toLowerCase() === 'approved' ?
                  `<button disabled style="flex: 1; padding: 0.5rem; background: #e2e8f0; color: #10b981; border: none; border-radius: 6px; font-weight: 600; cursor: not-allowed;"><i class="fas fa-check-double"></i> Approved</button>` :
                  `<button disabled style="flex: 1; padding: 0.5rem; background: #e2e8f0; color: #dc2626; border: none; border-radius: 6px; font-weight: 600; cursor: not-allowed;"><i class="fas fa-times"></i> Rejected</button>`
              ) : ''}
            </div>
            
          </div>
          <div class="message-meta">
            <span class="message-time">${this.formatMessageTime(this.getMessageTimestamp(msg))}</span>
            ${isSent ? `<span class="message-status"><i class="fas fa-check${msg.is_read ? '-double' : ''}"></i></span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  async openPermissionTimeline(permissionId) {
    // Create or show modal
    let modal = document.getElementById('permissionTimelineModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'permissionTimelineModal';
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
        z-index: 10000; backdrop-filter: blur(4px);
      `;
      modal.innerHTML = `
        <div style="background: white; width: 90%; max-width: 400px; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: modalIn 0.3s ease;">
          <div style="padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
            <h3 style="margin: 0; font-size: 1.1rem; color: #0f172a;">Track Permission Status</h3>
            <button onclick="document.getElementById('permissionTimelineModal').remove()" style="background: transparent; border: none; font-size: 1.25rem; color: #64748b; cursor: pointer;">&times;</button>
          </div>
          <div id="ptmContent" style="padding: 1.5rem;">
            <div style="text-align: center; color: #64748b;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    
    const content = document.getElementById('ptmContent');
    try {
      const res = await fetch(`${this.API}/permissions/user/${this.user.user_id}`);
      const data = await res.json();
      
      if (data.success) {
        const perm = data.permissions.find(p => p.id === permissionId);
        if (!perm) {
          content.innerHTML = `
            <div style="position: relative; padding-left: 20px; border-left: 2px solid #e2e8f0; margin-left: 10px; display: flex; flex-direction: column; gap: 1.5rem;">
              <div style="position: relative;">
                <div style="position: absolute; left: -29px; top: 0; width: 16px; height: 16px; border-radius: 50%; background: #ef4444; border: 2px solid white;"></div>
                <div style="color: #b91c1c; font-weight: 700; margin-bottom: 0.25rem; font-size: 0.95rem;"><i class="fas fa-times-circle" style="width: 20px;"></i> Rejected / Removed</div>
                <div style="color: #64748b; font-size: 0.85rem;">Admin rejected or removed this request.</div>
              </div>
            </div>`;
          return;
        }
        
        const stages = [
          { key: 'submitted', label: 'Submitted', icon: 'fa-paper-plane' },
          { key: 'seen', label: 'Seen by Admin', icon: 'fa-eye' },
          { key: 'approved', label: 'Approved', icon: 'fa-check' },
          { key: 'policy_generated', label: 'Policy Generated', icon: 'fa-shield-halved' },
          { key: 'attendance_used', label: 'Attendance Used', icon: 'fa-user-check' },
          { key: 'completed', label: 'Completed', icon: 'fa-flag-checkered' },
          { key: 'archived', label: 'Archived', icon: 'fa-box-archive' }
        ];
        
        // If rejected, short circuit
        const isRejected = perm.status === 'Rejected';
        
        let html = '<div style="position: relative; padding-left: 20px; border-left: 2px solid #e2e8f0; margin-left: 10px; display: flex; flex-direction: column; gap: 1.5rem;">';
        
        for (let i = 0; i < stages.length; i++) {
            const stage = stages[i];
            
            // If rejected and we are past 'seen', show rejected state and break
            if (isRejected && i === 2) {
                html += `
                  <div style="position: relative;">
                    <div style="position: absolute; left: -29px; top: 0; width: 16px; height: 16px; border-radius: 50%; background: #ef4444; border: 2px solid white;"></div>
                    <div style="color: #b91c1c; font-weight: 700; margin-bottom: 0.25rem; font-size: 0.95rem;"><i class="fas fa-times-circle" style="width: 20px;"></i> Rejected</div>
                    <div style="color: #64748b; font-size: 0.85rem;">Admin denied the request.</div>
                  </div>
                `;
                break;
            }
            
            const isDone = perm.timeline_stages[stage.key];
            const color = isDone ? '#2563eb' : '#cbd5e1';
            const textColor = isDone ? '#0f172a' : '#94a3b8';
            const iconColor = isDone ? '#3b82f6' : '#cbd5e1';
            
            html += `
              <div style="position: relative; opacity: ${isDone ? '1' : '0.6'};">
                <div style="position: absolute; left: -29px; top: 0; width: 16px; height: 16px; border-radius: 50%; background: ${color}; border: 2px solid white;"></div>
                <div style="color: ${textColor}; font-weight: ${isDone ? '700' : '500'}; margin-bottom: 0.25rem; font-size: 0.95rem;"><i class="fas ${stage.icon}" style="width: 20px; color: ${iconColor};"></i> ${stage.label}</div>
              </div>
            `;
        }
        
        html += '</div>';
        content.innerHTML = html;
        
      }
    } catch(e) {
      content.innerHTML = '<div style="color: red;">Failed to load timeline.</div>';
    }
  }

  async submitPermissionRequest() {
    if (!this.canRequestPermission()) {
      this.showToast('Permission requests can only be raised by faculty to admins.', 'error');
      return;
    }

    const permissionType = document.getElementById('permissionType')?.value?.trim();
    const customType = document.getElementById('customType')?.value?.trim();
    const customDaysCount = document.getElementById('customDaysCount')?.value?.trim();
    const permissionDate = document.getElementById('permissionDate')?.value;
    const startTime = document.getElementById('startTime')?.value;
    const endTime = document.getElementById('endTime')?.value;
    const reason = document.getElementById('permissionReason')?.value?.trim();
    const fileInput = document.getElementById('permissionDocument');
    const fullDay = document.getElementById('permissionFullDay')?.checked;
    const preset = this.getPermissionPreset(permissionType || 'late_arrival');

    if (!permissionType) {
      this.showToast('Please select a permission type', 'error');
      return;
    }

    if (permissionType === 'custom' && !customType) {
      this.showToast('Please describe your custom request', 'error');
      return;
    }

    if (permissionType === 'custom' && (!customDaysCount || Number(customDaysCount) < 1)) {
      this.showToast('Please enter how many days you want', 'error');
      return;
    }

    if (!permissionDate) {
      this.showToast('Please select a date', 'error');
      return;
    }

    if (!reason) {
      this.showToast('Please provide a reason/description', 'error');
      return;
    }

    if (preset.showTimeRange && !fullDay) {
      if (!startTime || !endTime) {
        this.showToast('Please select start and end times', 'error');
        return;
      }
      if (endTime <= startTime) {
        this.showToast('End time must be later than start time', 'error');
        return;
      }
    }

    // Check for existing permissions on the same day
    if (!this._overridePermissionId) {
      try {
        const pRes = await fetch(`${this.API}/permissions/user/${this.user.user_id}`);
        const pData = await pRes.json();
        if (pData.success) {
          const existingReq = pData.permissions.find(p => p.date === permissionDate);
          if (existingReq) {
            this.showDuplicatePermissionPrompt(existingReq);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to check existing permissions', e);
      }
    }

    try {
      const formData = new FormData();
      if (this._overridePermissionId) {
        formData.append('override_id', this._overridePermissionId);
      }
      formData.append('user_id', this.user.user_id);
      formData.append('type', permissionType === 'custom' ? 'custom' : permissionType);
      formData.append('custom_type', customType || '');
      formData.append('custom_days_count', permissionType === 'custom' ? (customDaysCount || '1') : '');
      formData.append('date', permissionDate);
      formData.append('start_time', startTime || '');
      formData.append('end_time', endTime || '');
      formData.append('is_full_day', fullDay ? 'true' : 'false');
      formData.append('reason', reason);
      const recipientId = this.assistantConnectionState === 'live_support_view' ? 'ADMIN01' : this.currentChat;
      const recipientName = this.assistantConnectionState === 'live_support_view' ? 'Admin' : this.currentChatUser;

      formData.append('recipient_id', recipientId);

      // Add file if present
      if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 5 * 1024 * 1024) {
          this.showToast('File size exceeds 5MB', 'error');
          return;
        }
        formData.append('document', file);
      }

      const res = await fetch(`${this.API}/permissions/request`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit request');
      }

      const attachmentUrl = data?.permission?.document_url || '';
      const permissionMessage = {
        sender_id: this.user.user_id,
        sender_name: this.user.name || this.user.user_id,
        recipient_id: recipientId,
        recipient_name: recipientName,
        content: this.buildPermissionMessageContent({
          permissionType,
          customType,
          customDaysCount,
          permissionDate,
          startTime,
          endTime,
          reason,
          fullDay,
          hasDocument: Boolean(fileInput && fileInput.files.length > 0),
          attachmentUrl,
          permissionId: data.permission_id
        }),
        created_at: new Date().toISOString(),
        is_read: true,
        message_type: 'permission_request',
        permission_id: data.permission_id
      };

      if (this.assistantConnectionState === 'live_support_view') {
        const container = document.getElementById('lsUserMessages');
        if (container) {
          container.innerHTML += this.renderPermissionRequestCard(permissionMessage, true);
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
        
        // Notify the admin in the Live Support chat that a request was raised
        if (this.currentLiveSession && this.currentLiveSession.id) {
          const typeLabel = permissionType === 'custom' ? customType : (preset?.label || permissionType);
          const liveMsg = `📌 *Exception Request Submitted*\nType: ${typeLabel}\nDate: ${permissionDate}\nReason: ${reason}\n\n(This request has been logged. Admin, please review in your Permissions dashboard.)`;
          
          fetch(`${this.API}/assistant/messages/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connection_id: this.currentLiveSession.id,
              sender_id: this.user.user_id,
              content: liveMsg
            })
          }).catch(e => console.warn('Failed to send live notification', e));
        }
      } else {
        if (!this.conversations[this.currentChat]) {
          this.conversations[this.currentChat] = {
            id: this.currentChat,
            name: this.currentChatUser,
            messages: [],
            unread: 0,
            lastMessage: null,
            lastTime: null
          };
        }
        if (this._overridePermissionId) {
          await this.loadConversationMessages(this.currentChat, this.currentChatUser);
        } else {
          this.conversations[this.currentChat].messages.push(permissionMessage);
          this.conversations[this.currentChat].role = this.currentChatUserRole || this.conversations[this.currentChat].role || null;
          this.renderConversation();
          this.renderConversations();
        }
      }

      this.hideAllModals();
      this.showToast('Exception proposal submitted successfully.', 'success');
      this.resetPermissionRequestForm();

    } catch (err) {
      console.error('Failed to submit permission request:', err);
      this.showToast(err.message || 'Failed to submit request', 'error');
    } finally {
      this._overridePermissionId = null;
    }
  }

  showModal(id) {
    const modal = document.getElementById(id);
    const overlay = document.getElementById('modalOverlay');
    if (!modal || !overlay) return;

    modal.classList.add('show');
    overlay.classList.add('show');

    if (id === 'newMessageModal') {
      const input = document.getElementById('userIdInput');
      if (input) {
        input.value = '';
        this.selectedUserForNewConversation = null;
        this.hideUserSuggestions();
        setTimeout(() => input.focus(), 0);
      }
    }
  }

  hideAllModals() {
    document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('show'));
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('show');
  }

  toggleHeaderMenu() {
    const menu = document.getElementById('headerMenu');
    if (!menu) return;
    this.headerMenuOpen = !this.headerMenuOpen;
    menu.classList.toggle('show', this.headerMenuOpen);
  }

  hideHeaderMenu() {
    const menu = document.getElementById('headerMenu');
    if (!menu) return;
    this.headerMenuOpen = false;
    menu.classList.remove('show');
  }

  async clearCurrentConversation() {
    if (!this.currentChat) {
      this.showToast('Open a chat first', 'info');
      return;
    }

    await this.clearConversationById(this.currentChat, this.currentChatUser, true);
  }

  async clearConversationById(userId, userName, fromOpenChat = false, skipConfirm = false) {
    if (!skipConfirm) {
      const ok = confirm(`Are you sure you want to permanently delete the chat history with ${userName || userId}?`);
      if (!ok) return;
    }

    try {
      const res = await fetch(`${this.API}/messages/${this.user.user_id}/with/${userId}`);
      const data = await res.json();
      const msgs = Array.isArray(data.messages) ? data.messages : [];

      await Promise.all(msgs.map(msg =>
        fetch(`${this.API}/messages/${msg.id}`, { method: 'DELETE' })
      ));

      if (this.conversations[userId]) {
        this.conversations[userId].messages = [];
        this.conversations[userId].lastMessage = null;
        this.conversations[userId].lastTime = null;
      }
      delete this.messageDrafts[userId];
      localStorage.setItem(this.draftStorageKey, JSON.stringify(this.messageDrafts));

      if (fromOpenChat || this.currentChat === userId) {
        this.renderConversation();
      }

      await this.loadConversations();
      this.showToast('Chat cleared', 'success');
    } catch (err) {
      this.showToast('Failed to clear chat', 'error');
    }
  }

  updateHeaderSubtitle(text) {
    const subtitle = document.getElementById('headerSubtitle');
    if (subtitle) subtitle.textContent = text;
  }

  enterChatView() {
    if (!this.isMobileView) return;

    const panel = document.getElementById('convPanel');
    const area = document.getElementById('chatArea');
    if (panel) panel.classList.add('hidden');
    if (area) area.classList.add('active');
  }

  exitChatView(clearConversation = false) {
    const panel = document.getElementById('convPanel');
    const area = document.getElementById('chatArea');

    if (this.isMobileView) {
      if (panel) panel.classList.remove('hidden');
      if (area) area.classList.remove('active');
    }

    if (clearConversation) {
      this.currentChat = null;
      this.currentChatUser = null;
      if (area && this.activeTab === 'messages') {
        area.innerHTML = `
          <div class="chat-empty">
            <div class="empty-illustration">
              <i class="fas fa-comments"></i>
            </div>
            <h2>Select a conversation</h2>
            <p>Choose from your messages to get started</p>
          </div>
        `;
      }
      this.renderConversations();
    }
  }

  handleBackAction() {
    const area = document.getElementById('chatArea');
    const isInChatView = this.isMobileView && area?.classList.contains('active');

    if (isInChatView) {
      if (this.activeTab === 'messages') {
        this.exitChatView(false);
      } else {
        this.activeTab = 'messages';
        document.querySelectorAll('.tab-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tab === 'messages');
        });
        this.switchTab('messages');
      }
      return;
    }

    this.goBack();
  }

  goBack() {
    const dashboard = this.user?.role === 'admin' ? 'admin_dashboard.html' : 'faculty_dashboard.html';
    window.location.href = `./${dashboard}`;
  }

  showSessionExpired() {
    document.body.innerHTML = `
      <div class="session-expired">
        <i class="fas fa-lock"></i>
        <h2>Session Expired</h2>
        <p>Please log in to continue</p>
        <button class="btn-primary" onclick="window.location.href='./login.html'">Back to Login</button>
      </div>
    `;
  }

  startPolling() {
    this.pollInterval = setInterval(async () => {
      if (this.activeTab === 'alerts') {
        await this.loadAlerts();
      } else if (this.activeTab === 'messages') {
        await this.loadConversations();
      }
      this.checkSupportQueue();
    }, 5000);
    this.checkSupportQueue();
  }

  async checkSupportQueue() {
    if (!this.user) return;
    try {
      const res = await fetch(`${this.API}/assistant/unread_count?user_id=${this.user.user_id}`);
      const data = await res.json();
      
      const event = new CustomEvent('SupportBridgeStateChanged', {
          detail: {
              count: data.count,
              status: data.status,
              connection_id: data.connection_id
          }
      });
      window.dispatchEvent(event);
    } catch(e) {
      console.error('Failed to check support queue', e);
    }
  }

  // ==========================================
  // INLINE CHAT PERMISSION APPROVAL (VIA MODAL)
  // ==========================================
  
  openReviewModalFromChat(permissionId, dataStr, btnElement) {
      let data;
      try {
          data = JSON.parse(decodeURIComponent(dataStr));
      } catch (e) {
          console.error("Failed to parse permission data", e);
          return;
      }

      if (String(data.type).toLowerCase() === 'custom') {
          alert("Custom permission requests involve highly specific policy rules.\n\nPlease open the Admin Dashboard to review and approve Custom requests using the Policy Builder UI.");
          return;
      }

      // 1. Inject Modal HTML if it doesn't exist
      if (!document.getElementById('chatReviewModal')) {
          const modalHtml = `
          <div id="chatReviewModal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); z-index: 10000; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 1rem;">
              <div style="background: #ffffff; width: 100%; max-width: 500px; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15); display: flex; flex-direction: column; max-height: 90vh; overflow: hidden; border: 1px solid #e2e8f0; animation: modalIn 0.3s ease;">
                  <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
                      <div>
                          <h2 style="margin: 0; font-size: 1.25rem; color: #0f172a; font-weight: 700;">Request Review</h2>
                          <p style="margin: 0.25rem 0 0 0; color: #64748b; font-size: 0.85rem;">Review details and set time window.</p>
                      </div>
                      <button onclick="document.getElementById('chatReviewModal').style.display='none'" style="background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 1.5rem; transition: color 0.2s;">&times;</button>
                  </div>
                  <div style="padding: 1.5rem; overflow-y: auto; flex: 1; background: #ffffff;">
                      <div style="margin-bottom: 1.5rem; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; background: #fafafa;">
                          <h4 style="margin: 0 0 0.75rem 0; color: #334155; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Faculty Request</h4>
                          <div style="display: grid; grid-template-columns: 80px 1fr; gap: 0.5rem; font-size: 0.9rem;">
                              <div style="color: #64748b; font-weight: 600;">Faculty</div><div id="crmFaculty" style="color: #0f172a;">--</div>
                              <div style="color: #64748b; font-weight: 600;">Date</div><div id="crmDate" style="color: #0f172a;">--</div>
                              <div style="color: #64748b; font-weight: 600;">Scope</div><div id="crmScope" style="color: #0f172a;">--</div>
                              <div style="color: #64748b; font-weight: 600;">Reason</div><div id="crmReason" style="color: #0f172a;">--</div>
                              <div style="color: #64748b; font-weight: 600;">Proof</div><div id="crmProof" style="color: #0f172a;">--</div>
                          </div>
                      </div>
                      <div style="margin-bottom: 1.5rem; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; background: #f8fafc;">
                          <h4 style="margin: 0 0 0.75rem 0; color: #334155; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">System Behaviour</h4>
                          <div id="crmRules" style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.85rem; color: #475569; margin-bottom: 1.25rem;"></div>
                          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px dashed #cbd5e1;">
                              <h4 style="margin: 0; color: #334155; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Attendance Type</h4>
                              <div id="crmModifier" style="background: #eef2ff; color: #4f46e5; padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid #c7d2fe; font-weight: 700; font-size: 0.9rem;">--</div>
                          </div>
                      </div>
                      <div>
                          <h4 style="margin: 0 0 0.75rem 0; color: #334155; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">Admin Decision</h4>
                          <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                              <div style="flex: 1;">
                                  <label style="display: block; font-weight: 600; color: #334155; margin-bottom: 0.25rem; font-size: 0.85rem;">Valid From</label>
                                  <input type="time" id="crmValidFrom" style="width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; outline: none;">
                              </div>
                              <div style="flex: 1;">
                                  <label style="display: block; font-weight: 600; color: #334155; margin-bottom: 0.25rem; font-size: 0.85rem;">Allowed Until</label>
                                  <input type="time" id="crmValidUntil" style="width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; outline: none;">
                              </div>
                          </div>
                          <div>
                              <label style="display: block; font-weight: 600; color: #334155; margin-bottom: 0.25rem; font-size: 0.85rem;">Remarks</label>
                              <input type="text" id="crmRemarks" placeholder="Approved via chat..." style="width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; outline: none;">
                          </div>
                      </div>
                  </div>
                  <div style="padding: 1.25rem 1.5rem; border-top: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: flex-end; gap: 0.75rem;">
                      <button onclick="document.getElementById('chatReviewModal').style.display='none'" style="padding: 0.6rem 1.25rem; background: #ffffff; border: 1px solid #dc2626; border-radius: 6px; color: #dc2626; font-weight: 600; cursor: pointer;">Cancel</button>
                      <button id="crmSubmitBtn" style="padding: 0.6rem 1.5rem; background: #10b981; border: none; border-radius: 6px; color: white; font-weight: 600; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">Approve</button>
                  </div>
              </div>
          </div>`;
          document.body.insertAdjacentHTML('beforeend', modalHtml);
      }

      // 2. Populate Modal Data
      const CHAT_TEMPLATE_POLICIES = {
          'late_arrival': { modifier: 'LP', priority: 20, policy: { attendance_status: 'FD', require_face: true, require_gps: true, require_geofence: true, require_morning: true, require_evening: true, morning_deadline: null, evening_deadline: null } },
          'early_departure': { modifier: 'EP', priority: 20, policy: { attendance_status: 'FD', require_face: true, require_gps: true, require_geofence: true, require_morning: true, require_evening: true, morning_deadline: null, evening_deadline: null } },
          'extended_campus_exit': { modifier: 'ECE', priority: 20, policy: { attendance_status: 'FD', require_face: true, require_gps: true, require_geofence: false, require_morning: true, require_evening: true, morning_deadline: null, evening_deadline: null } },
          'half_day_morning': { modifier: 'HD-M', priority: 30, policy: { attendance_status: 'HD', require_face: true, require_gps: true, require_geofence: true, require_morning: false, require_evening: true, morning_deadline: null, evening_deadline: null } },
          'half_day_afternoon': { modifier: 'HD-A', priority: 30, policy: { attendance_status: 'HD', require_face: true, require_gps: true, require_geofence: true, require_morning: true, require_evening: false, morning_deadline: null, evening_deadline: null } },
          'work_from_home': { modifier: 'WFH', priority: 50, policy: { attendance_status: 'FD', require_face: true, require_gps: false, require_geofence: false, require_morning: true, require_evening: true, morning_deadline: null, evening_deadline: null } },
          'on_duty': { modifier: 'OD', priority: 40, policy: { attendance_status: 'FD', require_face: false, require_gps: false, require_geofence: false, require_morning: false, require_evening: false, morning_deadline: null, evening_deadline: null } },
          'outdoor_duty': { modifier: 'OUT', priority: 40, policy: { attendance_status: 'FD', require_face: true, require_gps: false, require_geofence: false, require_morning: true, require_evening: true, morning_deadline: null, evening_deadline: null } },
          'medical_leave': { modifier: 'ML', priority: 90, policy: { attendance_status: 'LV', require_face: false, require_gps: false, require_geofence: false, require_morning: false, require_evening: false, morning_deadline: null, evening_deadline: null } },
          'full_day_absence': { modifier: 'LV', priority: 80, policy: { attendance_status: 'LV', require_face: false, require_gps: false, require_geofence: false, require_morning: false, require_evening: false, morning_deadline: null, evening_deadline: null } },
          'emergency': { modifier: 'EMG', priority: 100, policy: { attendance_status: 'LV', require_face: false, require_gps: false, require_geofence: false, require_morning: false, require_evening: false, morning_deadline: null, evening_deadline: null } }
      };

      document.getElementById('crmFaculty').textContent = data.faculty_id || '--';
      document.getElementById('crmDate').textContent = data.date || '--';
      document.getElementById('crmScope').textContent = data.scope || '--';
      document.getElementById('crmReason').textContent = data.reason || '--';
      
      const proofStr = data.attachment || data['attachment url'] || data.proof;
      if (proofStr && proofStr !== 'Not specified' && proofStr !== 'Not attached') {
          document.getElementById('crmProof').innerHTML = `<a href="${proofStr}" target="_blank" style="color: #2563eb; text-decoration: underline;">View File</a>`;
      } else {
          document.getElementById('crmProof').textContent = 'None';
      }

      const templateType = String(data.type).toLowerCase().replace(/ /g, '_');
      const template = CHAT_TEMPLATE_POLICIES[templateType] || CHAT_TEMPLATE_POLICIES['late_arrival'];
      document.getElementById('crmModifier').textContent = `${data.type} (${template.modifier})`;

      // Render Rules
      let rulesHtml = '';
      const p = template.policy;
      if (p.require_face) rulesHtml += `<div><i class="fas fa-check" style="color: #10b981; margin-right: 6px;"></i> Face verification required</div>`;
      else rulesHtml += `<div><i class="fas fa-times" style="color: #64748b; margin-right: 6px;"></i> Face verification waived</div>`;
      
      if (!p.require_gps || !p.require_geofence) rulesHtml += `<div><i class="fas fa-check" style="color: #10b981; margin-right: 6px;"></i> Attendance may be marked outside campus</div>`;
      else rulesHtml += `<div><i class="fas fa-map-marker-alt" style="color: #64748b; margin-right: 6px;"></i> Must be on campus</div>`;

      if (p.require_morning) rulesHtml += `<div style="margin-top: 4px;"><i class="fas fa-clock" style="color: #3b82f6; margin-right: 6px;"></i> Morning mark required</div>`;
      else rulesHtml += `<div style="margin-top: 4px;"><i class="fas fa-clock" style="color: #64748b; margin-right: 6px;"></i> Morning mark waived</div>`;

      if (p.require_evening) rulesHtml += `<div style="margin-top: 4px;"><i class="fas fa-clock" style="color: #3b82f6; margin-right: 6px;"></i> Evening checkout required</div>`;
      else rulesHtml += `<div style="margin-top: 4px;"><i class="fas fa-clock" style="color: #64748b; margin-right: 6px;"></i> Evening checkout waived</div>`;

      document.getElementById('crmRules').innerHTML = rulesHtml;

      document.getElementById('crmValidFrom').value = '09:00';
      document.getElementById('crmValidUntil').value = '18:00';
      document.getElementById('crmRemarks').value = '';

      // Bind submit function
      const submitBtn = document.getElementById('crmSubmitBtn');
      submitBtn.onclick = () => this.submitReviewFromChat(permissionId, template, data.date, btnElement);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Approve';

      // 3. Show Modal
      document.getElementById('chatReviewModal').style.display = 'flex';
  }

  async submitReviewFromChat(permissionId, template, reqDateRaw, btnElement) {
      const submitBtn = document.getElementById('crmSubmitBtn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Approving...';

      const validFromTime = document.getElementById('crmValidFrom').value;
      const validUntilTime = document.getElementById('crmValidUntil').value;
      const remarks = document.getElementById('crmRemarks').value || 'Approved via chat review.';
      
      const reqDate = (reqDateRaw && reqDateRaw !== '--') ? reqDateRaw : new Date().toISOString().split('T')[0];
      
      const payload = {
          admin_id: this.user.id || this.user.user_id,
          decision: 'Approved',
          decision_reason: remarks,
          modifier: template.modifier,
          priority: template.priority,
          valid_from: `${reqDate}T${validFromTime}:00`,
          valid_until: `${reqDate}T${validUntilTime}:00`,
          internal_notes: '',
          effective_policy: template.policy
      };

      try {
          const response = await fetch(`${this.API}/admin/permissions/${permissionId}/decision`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          const result = await response.json();
          if (!response.ok || !result.success) throw new Error(result.message || 'Failed to approve');

          this.showToast(`Request #${permissionId} approved successfully!`, 'success');
          
          // Close modal
          document.getElementById('chatReviewModal').style.display = 'none';

          // visually update the button inside the chat message to "Approved"
          if (btnElement) {
              btnElement.disabled = true;
              btnElement.style.background = '#e2e8f0';
              btnElement.style.color = '#10b981';
              btnElement.innerHTML = '<i class="fas fa-check-double"></i> Approved';
              btnElement.removeAttribute('onclick'); // prevent double clicks
          }

          // Sync Dashboard if loaded
          if (typeof window.loadPendingDecisions === 'function') {
              window.loadPendingDecisions();
          }
      } catch (error) {
          console.error("Chat Appv Error", error);
          alert(error.message);
          submitBtn.disabled = false;
          submitBtn.textContent = 'Approve';
      }
  }

  async approvePermissionFromChat(permissionId, type) {
    if (String(type).toLowerCase() === 'custom') {
      alert("Custom permission requests involve highly specific policy rules.\n\nPlease open the Admin Dashboard to review and approve Custom requests using the Policy Builder UI.");
      return;
    }

    const CHAT_TEMPLATE_POLICIES = {
        'late_arrival': { modifier: 'LP', priority: 20, policy: { attendance_status: 'FD', require_face: true, require_gps: true, require_geofence: true, require_morning: true, require_evening: true, morning_deadline: null, evening_deadline: null } },
        'early_departure': { modifier: 'EP', priority: 20, policy: { attendance_status: 'FD', require_face: true, require_gps: true, require_geofence: true, require_morning: true, require_evening: true, morning_deadline: null, evening_deadline: null } },
        'extended_campus_exit': { modifier: 'ECE', priority: 20, policy: { attendance_status: 'FD', require_face: true, require_gps: true, require_geofence: false, require_morning: true, require_evening: true, morning_deadline: null, evening_deadline: null } },
        'half_day_morning': { modifier: 'HD-M', priority: 30, policy: { attendance_status: 'HD', require_face: true, require_gps: true, require_geofence: true, require_morning: false, require_evening: true, morning_deadline: null, evening_deadline: null } },
        'half_day_afternoon': { modifier: 'HD-A', priority: 30, policy: { attendance_status: 'HD', require_face: true, require_gps: true, require_geofence: true, require_morning: true, require_evening: false, morning_deadline: null, evening_deadline: null } },
        'work_from_home': { modifier: 'WFH', priority: 50, policy: { attendance_status: 'FD', require_face: true, require_gps: false, require_geofence: false, require_morning: true, require_evening: true, morning_deadline: null, evening_deadline: null } },
        'on_duty': { modifier: 'OD', priority: 40, policy: { attendance_status: 'FD', require_face: false, require_gps: false, require_geofence: false, require_morning: false, require_evening: false, morning_deadline: null, evening_deadline: null } },
        'outdoor_duty': { modifier: 'OUT', priority: 40, policy: { attendance_status: 'FD', require_face: true, require_gps: false, require_geofence: false, require_morning: true, require_evening: true, morning_deadline: null, evening_deadline: null } },
        'medical_leave': { modifier: 'ML', priority: 90, policy: { attendance_status: 'LV', require_face: false, require_gps: false, require_geofence: false, require_morning: false, require_evening: false, morning_deadline: null, evening_deadline: null } },
        'full_day_absence': { modifier: 'LV', priority: 80, policy: { attendance_status: 'LV', require_face: false, require_gps: false, require_geofence: false, require_morning: false, require_evening: false, morning_deadline: null, evening_deadline: null } },
        'emergency': { modifier: 'EMG', priority: 100, policy: { attendance_status: 'LV', require_face: false, require_gps: false, require_geofence: false, require_morning: false, require_evening: false, morning_deadline: null, evening_deadline: null } }
    };

    const templateType = String(type).toLowerCase().replace(/ /g, '_');
    const template = CHAT_TEMPLATE_POLICIES[templateType] || CHAT_TEMPLATE_POLICIES['late_arrival'];

    const reqDate = new Date().toISOString().split('T')[0]; // We could extract from message, but dashboard defaults to today if undefined
    const payload = {
        admin_id: this.user.id || this.user.user_id,
        decision: 'Approved',
        decision_reason: 'Approved via Chat (Standard Template).',
        modifier: template.modifier,
        priority: template.priority,
        valid_from: `${reqDate}T00:00:00`,
        valid_until: `${reqDate}T23:59:00`,
        internal_notes: '',
        effective_policy: template.policy
    };

    try {
        const response = await fetch(`${this.API}/admin/permissions/${permissionId}/decision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Failed to approve');

        this.showToast(`Request #${permissionId} approved successfully!`, 'success');
        
        // Sync Dashboard if it is loaded (e.g., chat modal inside Admin Dashboard)
        if (typeof window.fetchPermissions === 'function') {
            window.fetchPermissions(payload.admin_id);
        }

        // Reload chat to show updated approval decision
        if (this.currentChat) {
            await this.loadConversationMessages(this.currentChat, this.currentChatUser);
        }
    } catch (e) {
        this.showToast(e.message, 'error');
    }
  }
  showDuplicatePermissionPrompt(existingReq) {
    const timeString = existingReq.start_time && existingReq.end_time 
      ? `<p style="margin: 0 0 0.5rem 0;"><strong>Time:</strong> ${this.escapeHtml(existingReq.start_time)} - ${this.escapeHtml(existingReq.end_time)}</p>` 
      : (existingReq.is_full_day ? `<p style="margin: 0 0 0.5rem 0;"><strong>Time:</strong> Full Day</p>` : '');
    const proofString = existingReq.document_url || existingReq.document_path 
      ? `<p style="margin: 0;"><strong>Proof:</strong> Attached</p>` 
      : `<p style="margin: 0;"><strong>Proof:</strong> None</p>`;

    const detailsHtml = `
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 1rem; margin-bottom: 1rem; border-radius: 4px;">
        <p style="margin: 0; color: #92400e; font-weight: 500;">You have already raised a request for this day (${this.escapeHtml(existingReq.date)}).</p>
      </div>
      <div style="background: #f8fafc; padding: 1rem; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 0.9rem; margin-bottom: 1.5rem;">
        <p style="margin: 0 0 0.5rem 0;"><strong>Current Status:</strong> <span class="status-badge status-${existingReq.status ? existingReq.status.toLowerCase() : 'pending'}">${this.escapeHtml(existingReq.status)}</span></p>
        <p style="margin: 0 0 0.5rem 0;"><strong>Type:</strong> ${this.escapeHtml(existingReq.type)}</p>
        <p style="margin: 0 0 0.5rem 0;"><strong>Date:</strong> ${this.escapeHtml(existingReq.date)}</p>
        ${timeString}
        <p style="margin: 0 0 0.5rem 0;"><strong>Reason:</strong> ${this.escapeHtml(existingReq.reason)}</p>
        ${proofString}
      </div>
      <div style="display: flex; gap: 1rem; justify-content: flex-end;">
        <button class="btn-secondary" id="btnDupPermIgnore" style="flex: 1;">Let it be</button>
        <button class="btn-primary" id="btnDupPermUpdate" style="flex: 1;">Update It</button>
      </div>
    `;

    let modal = document.getElementById('duplicatePermissionModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'duplicatePermissionModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px; max-height: 85vh; overflow-y: auto;">
          <div class="modal-header">
            <h2>Duplicate Request Found</h2>
            <button class="modal-close" id="btnDupPermClose">&times;</button>
          </div>
          <div class="modal-body">
            ${detailsHtml}
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      document.getElementById('btnDupPermClose').addEventListener('click', () => modal.classList.remove('show'));
      document.getElementById('btnDupPermIgnore').addEventListener('click', () => modal.classList.remove('show'));
      document.getElementById('btnDupPermUpdate').addEventListener('click', () => {
        modal.classList.remove('show');
        this._overridePermissionId = existingReq.id;
        this.submitPermissionRequest();
      });
    } else {
        const bodyContent = modal.querySelector('.modal-body');
        bodyContent.innerHTML = detailsHtml;
        
        document.getElementById('btnDupPermIgnore').addEventListener('click', () => modal.classList.remove('show'));
        document.getElementById('btnDupPermUpdate').addEventListener('click', () => {
          modal.classList.remove('show');
          this._overridePermissionId = existingReq.id;
          this.submitPermissionRequest();
        });
    }

    modal.classList.add('show');
    
    // Also show the overlay
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.add('show');
  }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
  window.chatInterface = new ChatInterface();
});
