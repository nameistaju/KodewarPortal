/**
 * Helper utilities for the KODEWAR HR Workspace.
 * Full 9 Enterprise Categories matching backend classification service.
 */

export const HR_EMAIL_CATEGORIES = [
  'Job Application',
  'Document Submission',
  'Application + Documents',
  'Interview / Interview Response',
  'Offer / Onboarding',
  'Application Status / Rejection',
  'General Enquiry',
  'Other',
  'Needs Human Review'
];

/**
 * Deterministically classifies an email matching backend classifier.
 * Honors manual override; falls back to classifier rules when default or ambiguous.
 */
export const classifyEmailCategory = (email) => {
  if (!email) return 'Needs Human Review';
  if (email.manual_category_override && HR_EMAIL_CATEGORIES.includes(email.manual_category_override)) {
    return email.manual_category_override;
  }
  // If email already has an explicit category other than the database default 'Needs Human Review', use it:
  if (email.category && email.category !== 'Needs Human Review' && HR_EMAIL_CATEGORIES.includes(email.category)) {
    return email.category;
  }
  if (email.processing_status === 'FAILED') return 'Needs Human Review';

  const subj = (email.subject || '').trim();
  const snip = (email.snippet || '').trim();
  const atts = Array.isArray(email.attachments) ? email.attachments : [];
  const attFilenames = atts.map((a) => (a.filename || '').toLowerCase()).join(' ');
  const combined = `${subj} ${snip} ${attFilenames}`.toLowerCase();

  // 1. Employee Leave Notice & Internal Memos
  if (/leave information|leave request|permission letter/i.test(subj)) {
    return 'Other';
  }

  // 2. Offer / Onboarding
  if (
    /offer letter|appointment letter|joining report|internship offer|signed offer|onboarding|employment contract/i.test(subj) ||
    /signed offer|joining date|welcome to kodewar/i.test(combined)
  ) {
    return 'Offer / Onboarding';
  }

  // 3. Interview / Interview Response
  if (
    /interview|technical round|coding test|assessment link|google meet|walk-in|zoom meeting|screening round/i.test(subj) ||
    /interview scheduled|technical assessment|coding round/i.test(snip)
  ) {
    return 'Interview / Interview Response';
  }

  // 4. Status / Rejection / Delivery Failure
  if (/message delivery failure|undelivered|failure notice|mailer-daemon/i.test(subj)) {
    return 'Application Status / Rejection';
  }

  if (/application status|update regarding.*application|status of my application/i.test(subj) || /status of my application|update on my application/i.test(snip)) {
    return 'Application Status / Rejection';
  }

  // 5. Attachments & Content Analysis
  const hasResume =
    /resume|cv|biodata|curriculum/i.test(attFilenames) ||
    /resume|biodata|\bcv\b|_resume|\.pdf/i.test(snip) ||
    (/resume|cv/i.test(combined) && email.has_attachments);

  const hasAppIntent =
    /application for|applying for|applied for|interested in|interested for|express my interest|job drive|job vacancy|job opening|job application|hiring|candidature/i.test(subj) ||
    /application for|applying for|applied for|express my interest in|interested in the|interested for|following up on the application|consider my resume|consider my profile/i.test(snip);

  const hasDocSignals =
    /submission of photo|id card|passport photo|marksheet|degree|10th|12th|aadhaar|pan card|aadhar|relieving certificate|marks card|id_card|passport_photo|certificate submission/i.test(combined);

  if (hasResume && hasDocSignals) {
    return 'Application + Documents';
  }

  if (hasDocSignals && !hasResume) {
    return 'Document Submission';
  }

  if (
    hasResume ||
    hasAppIntent ||
    (email.has_attachments && /developer|engineer|intern|fresher|frontend|backend|java|python|react|full stack|trainee|candidature|cloud computing|cybersecurity/i.test(combined))
  ) {
    return 'Job Application';
  }

  // 6. General Enquiry
  if (
    /support for your team|hire glocal|b2b|consulting|partnership|business proposal|vendor/i.test(subj) ||
    /hire glocal|outsourcing|staffing agency/i.test(snip)
  ) {
    return 'General Enquiry';
  }

  // 7. Security alert / System
  if (/new sign-in|security alert|one-time sign in|verification code|add all your new email/i.test(subj)) {
    return 'Needs Human Review';
  }

  return 'Needs Human Review';
};

/**
 * Enterprise Monochrome & Neutral Category Styling
 */
export const CATEGORY_STYLES = {
  'Job Application': {
    label: 'Job Application',
    badgeClass: 'bg-black text-white border-black',
    dotClass: 'bg-emerald-400'
  },
  'Document Submission': {
    label: 'Document Submission',
    badgeClass: 'bg-neutral-800 text-neutral-100 border-neutral-700',
    dotClass: 'bg-sky-400'
  },
  'Application + Documents': {
    label: 'Application + Docs',
    badgeClass: 'bg-neutral-900 text-white border-neutral-800',
    dotClass: 'bg-teal-400'
  },
  'Interview / Interview Response': {
    label: 'Interview',
    badgeClass: 'bg-neutral-100 text-neutral-900 border-neutral-300 font-semibold',
    dotClass: 'bg-amber-500'
  },
  'Offer / Onboarding': {
    label: 'Offer / Onboarding',
    badgeClass: 'bg-neutral-100 text-neutral-900 border-neutral-400 font-semibold',
    dotClass: 'bg-emerald-600'
  },
  'Application Status / Rejection': {
    label: 'Status / Notice',
    badgeClass: 'bg-neutral-100 text-neutral-600 border-neutral-200',
    dotClass: 'bg-neutral-400'
  },
  'General Enquiry': {
    label: 'General Enquiry',
    badgeClass: 'bg-neutral-50 text-neutral-600 border-neutral-200',
    dotClass: 'bg-neutral-400'
  },
  'Needs Human Review': {
    label: 'Needs Review',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
    dotClass: 'bg-amber-500'
  },
  Other: {
    label: 'Other',
    badgeClass: 'bg-neutral-50 text-neutral-500 border-neutral-200',
    dotClass: 'bg-neutral-400'
  }
};

/**
 * Formats byte size into human-readable string.
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Checks if a sent_at timestamp falls within a date filter range.
 */
export const matchesDateFilter = (sentAt, dateFilter) => {
  if (!dateFilter || dateFilter === 'ALL') return true;
  if (!sentAt) return false;

  const date = new Date(sentAt);
  const now = new Date();
  const diffHours = (now - date) / (1000 * 60 * 60);

  if (dateFilter === '24H') return diffHours <= 24;
  if (dateFilter === '7D') return diffHours <= 24 * 7;
  if (dateFilter === '30D') return diffHours <= 24 * 30;
  return true;
};
