import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HR_EMAIL_CATEGORIES,
  classifyEmail,
  enrichEmailsWithClassification
} from '../src/services/hrEmailClassifier.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

test('HR Email Classifier: All 9 Enterprise Categories Defined', () => {
  assert.equal(HR_EMAIL_CATEGORIES.length, 9);
  assert.ok(HR_EMAIL_CATEGORIES.includes('Job Application'));
  assert.ok(HR_EMAIL_CATEGORIES.includes('Document Submission'));
  assert.ok(HR_EMAIL_CATEGORIES.includes('Application + Documents'));
  assert.ok(HR_EMAIL_CATEGORIES.includes('Interview / Interview Response'));
  assert.ok(HR_EMAIL_CATEGORIES.includes('Offer / Onboarding'));
  assert.ok(HR_EMAIL_CATEGORIES.includes('Application Status / Rejection'));
  assert.ok(HR_EMAIL_CATEGORIES.includes('General Enquiry'));
  assert.ok(HR_EMAIL_CATEGORIES.includes('Other'));
  assert.ok(HR_EMAIL_CATEGORIES.includes('Needs Human Review'));
});

test('HR Email Classifier: Job Application with Resume attachment', () => {
  const email = {
    subject: 'Application for java developer role',
    snippet: 'Dear HR, Please find attached my resume for your consideration.',
    has_attachments: true,
    attachments: [{ filename: 'Bantu_Resume.pdf', contentType: 'application/pdf', size: 102400 }]
  };
  const result = classifyEmail(email);
  assert.equal(result.category, 'Job Application');
  assert.equal(result.isManualOverride, false);
  assert.ok(result.confidence >= 0.85);
});

test('HR Email Classifier: Document Submission (Photo for ID Card / Marksheets without CV)', () => {
  const email = {
    subject: 'Submission of Photo for ID Card',
    snippet: 'Please find attached my passport size photo and 10th marksheet for verification.',
    has_attachments: true,
    attachments: [{ filename: 'passport_photo.jpg', contentType: 'image/jpeg', size: 54200 }]
  };
  const result = classifyEmail(email);
  assert.equal(result.category, 'Document Submission');
  assert.equal(result.isManualOverride, false);
  assert.ok(result.confidence >= 0.90);
});

test('HR Email Classifier: Application + Documents (both Resume and Certificates)', () => {
  const email = {
    subject: 'Application for Fresher Roles with Documents',
    snippet: 'Attached is my CV along with degree certificate and 10th marksheet.',
    has_attachments: true,
    attachments: [
      { filename: 'Naveen_CV.pdf', contentType: 'application/pdf', size: 154200 },
      { filename: 'BTech_Degree.pdf', contentType: 'application/pdf', size: 350000 }
    ]
  };
  const result = classifyEmail(email);
  assert.equal(result.category, 'Application + Documents');
  assert.equal(result.isManualOverride, false);
  assert.ok(result.confidence >= 0.90);
});

test('HR Email Classifier: Interview Scheduling and Responses', () => {
  const email = {
    subject: 'Application for Data Science Role — Walk-in Interview',
    snippet: 'Confirming attendance for the technical round and Google Meet interview scheduled tomorrow.',
    has_attachments: false,
    attachments: []
  };
  const result = classifyEmail(email);
  assert.equal(result.category, 'Interview / Interview Response');
  assert.ok(result.confidence >= 0.90);
});

test('HR Email Classifier: Offer / Onboarding Acceptance', () => {
  const email = {
    subject: 'Re: Internship Offer Letter — KODEWAR Technologies',
    snippet: 'Thank you for the offer. I am pleased to accept the appointment letter and joining date.',
    has_attachments: true,
    attachments: [{ filename: 'Signed_Offer_Letter.pdf', contentType: 'application/pdf', size: 85000 }]
  };
  const result = classifyEmail(email);
  assert.equal(result.category, 'Offer / Onboarding');
  assert.ok(result.confidence >= 0.95);
});

test('HR Email Classifier: Delivery Failure and Status Notices', () => {
  const email = {
    subject: 'Message Delivery Failure: Mailer-Daemon',
    snippet: 'Your message could not be delivered to the recipient domain.',
    has_attachments: false,
    attachments: []
  };
  const result = classifyEmail(email);
  assert.equal(result.category, 'Application Status / Rejection');
  assert.ok(result.confidence >= 0.95);
});

test('HR Email Classifier: General B2B / Vendor Enquiry', () => {
  const email = {
    subject: 'Web Development Support for Your Team & Client Projects',
    snippet: 'We provide staffing and IT consulting support for growing organizations.',
    has_attachments: false,
    attachments: []
  };
  const result = classifyEmail(email);
  assert.equal(result.category, 'General Enquiry');
  assert.ok(result.confidence >= 0.80);
});

test('HR Email Classifier: Security Alerts and Ambiguous Emails fallback to Needs Human Review', () => {
  const email = {
    subject: 'Security Alert: Your one-time sign in code is 230719',
    snippet: 'Use this code to verify your sign in.',
    has_attachments: false,
    attachments: []
  };
  const result = classifyEmail(email);
  assert.equal(result.category, 'Needs Human Review');
});

test('HR Email Classifier: Manual Category Override always takes 100% precedence', () => {
  const email = {
    subject: 'Security Alert: Your one-time sign in code is 230719',
    snippet: 'Use this code to verify your sign in.',
    has_attachments: false,
    manual_category_override: 'General Enquiry'
  };
  const result = classifyEmail(email);
  assert.equal(result.category, 'General Enquiry');
  assert.equal(result.isManualOverride, true);
  assert.equal(result.confidence, 1.0);
  assert.equal(result.reason, 'Manual override by HR');
});

test('HR Email Classifier: Batch enrichment function preserves existing and computes missing', () => {
  const emails = [
    { id: '1', subject: 'Java Developer', has_attachments: true, attachments: [{ filename: 'cv.pdf' }] },
    { id: '2', subject: 'Submission of Photo for ID Card', has_attachments: true, attachments: [{ filename: 'photo.jpg' }] }
  ];
  const enriched = enrichEmailsWithClassification(emails);
  assert.equal(enriched.length, 2);
  assert.equal(enriched[0].category, 'Job Application');
  assert.equal(enriched[1].category, 'Document Submission');
});

test('Error Handler Middleware: Normalizes Supabase PGRST205 schema cache errors to 503 SCHEMA_MIGRATION_PENDING', () => {
  const fakeError = new Error("Could not find the table 'public.hr_candidates' in the schema cache");
  fakeError.code = 'PGRST205';

  let capturedStatus = null;
  let capturedBody = null;

  const mockRes = {
    status(code) {
      capturedStatus = code;
      return this;
    },
    json(body) {
      capturedBody = body;
      return this;
    }
  };

  errorHandler(fakeError, {}, mockRes, () => {});

  assert.equal(capturedStatus, 503);
  assert.equal(capturedBody.success, false);
  assert.equal(capturedBody.code, 'SCHEMA_MIGRATION_PENDING');
  assert.equal(capturedBody.table, 'hr_candidates');
  assert.ok(capturedBody.migrationFile.includes('000_stage_b2_consolidated_migration.sql'));
});
