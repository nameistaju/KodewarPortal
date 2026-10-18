import { useState } from 'react';
import {
  FileText,
  Mail,
  Copy,
  CheckCircle2,
  Lock,
  Layers,
  Send
} from 'lucide-react';
import toast from 'react-hot-toast';

const standardTemplates = [
  {
    id: 'APP_ACK',
    name: 'Application Acknowledgment',
    category: 'Candidate Intake',
    subject: 'Thank you for applying to KODEWAR — {{role_title}}',
    body: `Dear {{candidate_name}},

Thank you for your interest in joining KODEWAR. We have safely received your application and resume for the {{role_title}} position.

Our technical recruitment team is actively reviewing your qualifications against the requisition requirements. If your profile aligns with our current needs, we will reach out directly to schedule an introductory technical discussion.

Best regards,
KODEWAR HR Operations Team
hr@kodewar.com`,
    tokens: ['{{candidate_name}}', '{{role_title}}', '{{company_name}}']
  },
  {
    id: 'INTERVIEW_INVITE',
    name: 'Technical Interview Invitation',
    category: 'Screening',
    subject: 'KODEWAR — Technical Interview Invitation for {{role_title}}',
    body: `Dear {{candidate_name}},

Following our initial review of your application, we are pleased to invite you to a 45-minute technical interview for the {{role_title}} position.

Interview Details:
- Date & Time: {{interview_datetime}}
- Meeting Link: {{meeting_url}}
- Interviewer: {{interviewer_name}} ({{interviewer_role}})

Please reply to this email to confirm your availability or propose an alternative time slot.

Best regards,
KODEWAR Recruitment Team`,
    tokens: ['{{candidate_name}}', '{{role_title}}', '{{interview_datetime}}', '{{meeting_url}}', '{{interviewer_name}}']
  },
  {
    id: 'DOC_REQUEST',
    name: 'Document Verification Request',
    category: 'Verification & Compliance',
    subject: 'KODEWAR HR — Verification Documents Required',
    body: `Dear {{candidate_name}},

As part of our standard onboarding and compliance verification process, please submit clear copies of the following documents:

1. Highest Educational Degree / Transcripts
2. Government ID Proof (Aadhaar / Passport / PAN)
3. Relieving Letter & Last 3 Months Salary Slips (if applicable)

Please reply directly to this email with the requested files attached in PDF format.

Best regards,
KODEWAR HR Compliance Team`,
    tokens: ['{{candidate_name}}', '{{role_title}}']
  },
  {
    id: 'OFFER_LETTER',
    name: 'Offer Letter & Onboarding',
    category: 'Offers',
    subject: 'Offer of Employment — KODEWAR ({{role_title}})',
    body: `Dear {{candidate_name}},

On behalf of KODEWAR, we are thrilled to offer you the position of {{role_title}}!

The leadership team was thoroughly impressed with your technical capabilities, problem-solving mindset, and alignment with our engineering culture.

Please review the attached formal offer letter detailing compensation, benefits, and start date. We look forward to welcoming you to the KODEWAR workforce!

Warm regards,
KODEWAR Talent Acquisition`,
    tokens: ['{{candidate_name}}', '{{role_title}}', '{{start_date}}', '{{ctc}}']
  },
  {
    id: 'REJECTION_POLITE',
    name: 'Application Status Update (Regret)',
    category: 'Communications',
    subject: 'KODEWAR Application Update — {{role_title}}',
    body: `Dear {{candidate_name}},

Thank you for taking the time to interview and explore opportunities with KODEWAR for the {{role_title}} position.

While your background is commendable, we have decided to proceed with another candidate whose experience more closely matches the immediate requirements of this specific opening.

We will keep your resume on file for future engineering opportunities that may align with your expertise. We wish you continued success in your professional endeavors.

Best regards,
KODEWAR Recruitment Team`,
    tokens: ['{{candidate_name}}', '{{role_title}}']
  }
];

export default function HrEmailTemplatesView() {
  const [selectedTemplateId, setSelectedTemplateId] = useState(standardTemplates[0].id);

  const selectedTemplate = standardTemplates.find((t) => t.id === selectedTemplateId) || standardTemplates[0];

  const handleCopyBody = () => {
    navigator.clipboard?.writeText(selectedTemplate.body);
    toast.success('Template body copied to clipboard');
  };

  return (
    <div className="space-y-4">
      {/* Stage B Notice */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 text-xs text-neutral-700 space-y-1.5">
        <div className="flex items-center gap-2 text-neutral-900 font-bold">
          <Mail className="w-4 h-4 text-neutral-800" />
          <span>HR Communication Templates & SMTP Dispatch Queue · Stage B</span>
        </div>
        <p className="leading-relaxed text-neutral-600">
          Outbound email dispatch via Titan SMTP is currently disabled (<code>TITAN_MAIL_ENABLED=false</code>). Custom template storage (<code>public.hr_email_templates</code>) and automated dispatch queues will be connected in Stage B. The templates below provide standard verified communication patterns.
        </p>
      </div>

      {/* Main Two-Pane Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[500px]">
        {/* Template List (4 Cols) */}
        <div className="lg:col-span-4 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-xs space-y-2">
          <div className="pb-2 border-b border-neutral-100 px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900">
              Standard Templates ({standardTemplates.length})
            </h3>
          </div>

          <div className="space-y-1 pt-1">
            {standardTemplates.map((tpl) => {
              const isSelected = tpl.id === selectedTemplateId;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs'
                      : 'border-neutral-200 bg-neutral-50/40 hover:bg-neutral-100 hover:border-neutral-300 text-neutral-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs truncate">{tpl.name}</span>
                    <span
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                        isSelected ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-200 text-neutral-700'
                      }`}
                    >
                      {tpl.category}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] truncate mt-1 ${
                      isSelected ? 'text-neutral-400' : 'text-neutral-500'
                    }`}
                  >
                    {tpl.subject}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Template Detail & Preview (8 Cols) */}
        <div className="lg:col-span-8 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <div>
                <h2 className="text-sm font-bold text-neutral-900">{selectedTemplate.name}</h2>
                <p className="text-[11px] text-neutral-500 mt-0.5">Category: {selectedTemplate.category}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyBody}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 text-neutral-800 hover:bg-neutral-200 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Template</span>
                </button>

                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-200 text-neutral-500 cursor-not-allowed opacity-80"
                  title="Outbound email dispatch requires Stage B SMTP enablement"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send via SMTP</span>
                  <span className="text-[9px] uppercase font-bold px-1 rounded bg-neutral-300 text-neutral-700">
                    Stage B
                  </span>
                </button>
              </div>
            </div>

            {/* Subject preview */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Subject Line
              </span>
              <div className="p-2.5 rounded-lg border border-neutral-200 bg-neutral-50/50 text-xs font-semibold text-neutral-900">
                {selectedTemplate.subject}
              </div>
            </div>

            {/* Tokens */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Dynamic Variables
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedTemplate.tokens.map((token) => (
                  <span
                    key={token}
                    className="font-mono text-[10px] px-2 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-neutral-700"
                  >
                    {token}
                  </span>
                ))}
              </div>
            </div>

            {/* Body preview */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Template Body
              </span>
              <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50/20 max-h-[300px] overflow-y-auto">
                <pre className="font-sans whitespace-pre-wrap text-xs text-neutral-800 leading-relaxed break-words">
                  {selectedTemplate.body}
                </pre>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-400">
            <span>Template ID: {selectedTemplate.id}</span>
            <span>Security: TITAN_MAIL_ENABLED=false</span>
          </div>
        </div>
      </div>
    </div>
  );
}
