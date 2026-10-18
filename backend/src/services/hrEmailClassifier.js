/**
 * KODEWAR HR Email Classification Service
 * Deterministically categorizes inbound HR mailbox emails into enterprise recruitment categories.
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
 * Deterministically classifies a single email message.
 * @param {Object} email - Email record containing subject, snippet, attachments, etc.
 * @returns {Object} { category, confidence, reason, isManualOverride }
 */
export const classifyEmail = (email = {}) => {
  // If HR user has set a manual override, it always takes precedence with 100% confidence
  if (email.manual_category_override && HR_EMAIL_CATEGORIES.includes(email.manual_category_override)) {
    return {
      category: email.manual_category_override,
      confidence: 1.0,
      reason: 'Manual override by HR',
      isManualOverride: true
    };
  }

  const subj = (email.subject || '').trim();
  const snip = (email.snippet || '').trim();
  const atts = Array.isArray(email.attachments) ? email.attachments : [];
  const attFilenames = atts.map(a => (a.filename || '').toLowerCase()).join(' ');
  const combinedText = `${subj} ${snip} ${attFilenames}`.toLowerCase();

  // 1. Employee Leave Notice & Internal Memos
  if (/leave information|leave request|permission letter/i.test(subj)) {
    return {
      category: 'Other',
      confidence: 0.90,
      reason: 'Internal employee communication or leave notice',
      isManualOverride: false
    };
  }

  // 2. Offer / Onboarding
  if (
    /offer letter|appointment letter|joining report|internship offer|signed offer|onboarding|employment contract/i.test(subj) ||
    /signed offer|joining date|welcome to kodewar/i.test(combinedText)
  ) {
    return {
      category: 'Offer / Onboarding',
      confidence: 0.95,
      reason: 'Contains offer letter or onboarding references',
      isManualOverride: false
    };
  }

  // 3. Interview / Interview Response
  if (
    /interview|technical round|coding test|assessment link|google meet|walk-in|zoom meeting|screening round/i.test(subj) ||
    /interview scheduled|technical assessment|coding round/i.test(snip)
  ) {
    return {
      category: 'Interview / Interview Response',
      confidence: 0.90,
      reason: 'Contains interview scheduling or assessment signals',
      isManualOverride: false
    };
  }

  // 4. Application Status / Rejection / Delivery Failure
  if (/message delivery failure|undelivered|failure notice|mailer-daemon/i.test(subj)) {
    return {
      category: 'Application Status / Rejection',
      confidence: 0.95,
      reason: 'Delivery failure notice or mail bounce',
      isManualOverride: false
    };
  }

  // 5. Status Inquiry / Follow-up
  if (/application status|update regarding.*application|status of my application/i.test(subj) || /status of my application|update on my application/i.test(snip)) {
    return {
      category: 'Application Status / Rejection',
      confidence: 0.85,
      reason: 'Application status inquiry or follow-up',
      isManualOverride: false
    };
  }

  // 6. Resume & Application Signals
  const hasResume =
    /resume|cv|biodata|curriculum/i.test(attFilenames) ||
    /resume|biodata|\bcv\b|_resume|\.pdf/i.test(snip) ||
    (/resume|cv/i.test(combinedText) && email.has_attachments);

  const hasAppIntent =
    /application for|applying for|applied for|interested in|interested for|express my interest|job drive|job vacancy|job opening|job application|hiring|candidature/i.test(subj) ||
    /application for|applying for|applied for|express my interest in|interested in the|interested for|following up on the application|consider my resume|consider my profile/i.test(snip);

  const hasDocSignals =
    /submission of photo|id card|passport photo|marksheet|degree|10th|12th|aadhaar|pan card|aadhar|relieving certificate|marks card|id_card|passport_photo|certificate submission/i.test(combinedText);

  // Both resume and verification documents
  if (hasResume && hasDocSignals) {
    return {
      category: 'Application + Documents',
      confidence: 0.90,
      reason: 'Contains both resume and supporting verification documents',
      isManualOverride: false
    };
  }

  // Identity / Compliance document submission without resume
  if (hasDocSignals && !hasResume) {
    return {
      category: 'Document Submission',
      confidence: 0.90,
      reason: 'Contains identity photo or verification document references',
      isManualOverride: false
    };
  }

  // Direct Resume / Job Application
  if (
    hasResume ||
    hasAppIntent ||
    (email.has_attachments && /developer|engineer|intern|fresher|frontend|backend|java|python|react|full stack|trainee|candidature|cloud computing|cybersecurity/i.test(combinedText))
  ) {
    return {
      category: 'Job Application',
      confidence: 0.88,
      reason: 'Contains resume/CV or direct job application message',
      isManualOverride: false
    };
  }

  // 7. General Enquiry / B2B Proposals
  if (
    /support for your team|hire glocal|b2b|consulting|partnership|business proposal|vendor/i.test(subj) ||
    /hire glocal|outsourcing|staffing agency/i.test(snip)
  ) {
    return {
      category: 'General Enquiry',
      confidence: 0.85,
      reason: 'General business inquiry or vendor proposal',
      isManualOverride: false
    };
  }

  // 8. Security alerts / 2FA / Sign-in notices
  if (/new sign-in|security alert|one-time sign in|verification code|add all your new email/i.test(subj)) {
    return {
      category: 'Needs Human Review',
      confidence: 0.90,
      reason: 'System notification or security alert',
      isManualOverride: false
    };
  }

  // 9. Fallback for unclassified messages
  return {
    category: 'Needs Human Review',
    confidence: 0.40,
    reason: 'Ambiguous content requiring HR review',
    isManualOverride: false
  };
};

/**
 * Enriches an array of email objects with deterministic category metadata.
 * Prefers manual override if present; otherwise runs classifier.
 */
export const enrichEmailsWithClassification = (emails = []) => {
  return emails.map(email => {
    const classification = classifyEmail(email);
    const isManual = Boolean(email.manual_category_override);
    const category = isManual ? email.manual_category_override : classification.category;
    const confidence = isManual ? 1.0 : classification.confidence;
    const reason = isManual ? 'Manual override by HR' : classification.reason;

    return {
      ...email,
      category,
      classification_confidence: confidence,
      classification_reason: reason,
      manual_category_override: email.manual_category_override || null
    };
  });
};
