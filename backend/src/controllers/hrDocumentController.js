import catchAsync from '../utils/catchAsync.js';
import * as hrDocumentService from '../services/hrDocumentService.js';

export const getDocuments = catchAsync(async (req, res) => {
  const result = await hrDocumentService.getDocuments(req.query);
  res.status(200).json({
    success: true,
    data: result
  });
});

export const getDocumentById = catchAsync(async (req, res) => {
  const document = await hrDocumentService.getDocumentById(req.params.id);
  res.status(200).json({
    success: true,
    data: document
  });
});

export const updateDocumentReview = catchAsync(async (req, res) => {
  const updated = await hrDocumentService.updateDocumentReview(req.params.id, req.body, req.user);
  res.status(200).json({
    success: true,
    message: 'Document review status updated successfully',
    data: updated
  });
});

export const linkCandidate = catchAsync(async (req, res) => {
  const updated = await hrDocumentService.linkDocumentCandidate(req.params.id, req.body.candidateId, req.user);
  res.status(200).json({
    success: true,
    message: req.body.candidateId ? 'Document linked to candidate' : 'Document unlinked from candidate',
    data: updated
  });
});

export const syncMetadata = catchAsync(async (_req, res) => {
  const result = await hrDocumentService.syncAttachmentMetadata();
  res.status(200).json({
    success: true,
    message: 'Attachment metadata synchronized',
    data: result
  });
});
