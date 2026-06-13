import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';

import 'standard_tool_page.dart';

/// Reusable tool page definitions. Each entry maps a tool id
/// (matching `ToolRegistry.all[i].id`) to a `StandardToolPage`
/// configured with the right endpoint, form fields, and i18n
/// keys.
///
/// Adding a new "simple" tool = add a `ToolPageSpec` to the
/// [kSimpleToolPages] map. No new file needed. The router
/// picks it up automatically because we wire each one to a
/// static route below.

class ToolPageSpec {
  const ToolPageSpec({
    required this.titleKey,
    required this.subtitleKey,
    required this.endpoint,
    required this.formFields,
    this.actionIcon = Icons.arrow_forward,
    this.suggestedSuffix,
    this.outputExtension = 'pdf',
    this.preSubmitValidation,
  });

  final String titleKey;
  final String subtitleKey;
  final String endpoint;
  final List<ToolFormField> formFields;
  final IconData actionIcon;
  final String? suggestedSuffix;
  final String outputExtension;
  final String? Function(Map<String, dynamic> values)?
      preSubmitValidation;
}

/// Spec table. Add a new entry here to get a new tool page
/// without writing a new file. The i18n key prefix is always
/// `tools.<id>` and the page-specific keys are at the top
/// level of the `tools` block.
final Map<String, ToolPageSpec> kSimpleToolPages = {
  'add-remove-pages': ToolPageSpec(
    titleKey: 'tools.add_remove_pages',
    subtitleKey: 'tools.add_remove_pages_desc',
    endpoint: '/api/v1/pdf/add-remove-download',
    suggestedSuffix: '-trimmed',
    formFields: [
      ToolFormField(
        id: 'pages',
        label: 'Page numbers',
        hint: 'e.g. 1,3,5',
        required: true,
      ),
      ToolFormField(
        id: 'mode',
        label: 'Mode',
        type: FieldType.dropdown,
        options: const ['delete', 'keep'],
        required: true,
      ),
    ],
    preSubmitValidation: (v) =>
        (v['pages'] as String).trim().isEmpty ? 'Enter page numbers' : null,
  ),
  'extract-pages': ToolPageSpec(
    titleKey: 'tools.extract_pages',
    subtitleKey: 'tools.extract_pages_desc',
    endpoint: '/api/v1/pdf/extract-pages-download',
    suggestedSuffix: '-extracted',
    formFields: [
      ToolFormField(
        id: 'pages',
        label: 'Page numbers',
        hint: 'e.g. 1-3,5,7-9',
        required: true,
      ),
    ],
  ),
  'page-numbers': ToolPageSpec(
    titleKey: 'tools.page_numbers',
    subtitleKey: 'tools.page_numbers_desc',
    endpoint: '/api/v1/pdf/page-numbers-download',
    suggestedSuffix: '-numbered',
    formFields: [
      ToolFormField(
        id: 'format',
        label: 'Format',
        type: FieldType.dropdown,
        options: const ['Page N of M', 'Page N', 'N / M'],
        required: true,
      ),
      ToolFormField(
        id: 'position',
        label: 'Position',
        type: FieldType.dropdown,
        options: const [
          'bottom-center', 'bottom-right', 'bottom-left',
          'top-center', 'top-right', 'top-left',
        ],
        required: true,
      ),
    ],
  ),
  'rotate': ToolPageSpec(
    titleKey: 'tools.rotate',
    subtitleKey: 'tools.rotate_desc',
    endpoint: '/api/v1/pdf/rotate-download',
    suggestedSuffix: '-rotated',
    formFields: [
      ToolFormField(
        id: 'angle',
        label: 'Angle',
        type: FieldType.dropdown,
        options: const ['90', '180', '270'],
        required: true,
      ),
    ],
  ),
  'crop': ToolPageSpec(
    titleKey: 'tools.crop',
    subtitleKey: 'tools.crop_desc',
    endpoint: '/api/v1/pdf/crop-download',
    suggestedSuffix: '-cropped',
    formFields: [
      ToolFormField(id: 'left', label: 'Left (pt)', required: true),
      ToolFormField(id: 'top', label: 'Top (pt)', required: true),
      ToolFormField(id: 'right', label: 'Right (pt)', required: true),
      ToolFormField(id: 'bottom', label: 'Bottom (pt)', required: true),
    ],
  ),
  'repair': ToolPageSpec(
    titleKey: 'tools.repair',
    subtitleKey: 'tools.repair_desc',
    endpoint: '/api/v1/pdf/repair-download',
    suggestedSuffix: '-repaired',
    formFields: [
      ToolFormField(
        id: 'unlock',
        label: 'Try to remove passwords',
        type: FieldType.toggle,
      ),
      ToolFormField(
        id: 'linearize',
        label: 'Linearize for fast web view',
        type: FieldType.toggle,
      ),
      ToolFormField(
        id: 'ocr',
        label: 'OCR scanned pages',
        type: FieldType.toggle,
      ),
    ],
  ),
  'ocr': ToolPageSpec(
    titleKey: 'tools.ocr',
    subtitleKey: 'tools.ocr_desc',
    endpoint: '/api/v1/pdf/ocr-download',
    suggestedSuffix: '-ocr',
    formFields: [
      ToolFormField(
        id: 'lang',
        label: 'Language',
        type: FieldType.dropdown,
        options: const ['eng', 'spa', 'fra', 'deu', 'hin', 'ara', 'chi_sim', 'jpn', 'kor', 'rus'],
        required: true,
      ),
    ],
  ),
  'image-to-pdf': ToolPageSpec(
    titleKey: 'tools.image_to_pdf',
    subtitleKey: 'tools.image_to_pdf_desc',
    endpoint: '/api/v1/pdf/from-images-download',
    suggestedSuffix: '-converted',
    formFields: [
      ToolFormField(
        id: 'page_size',
        label: 'Page size',
        type: FieldType.dropdown,
        options: const ['A4', 'Letter', 'Legal', 'A3', 'A5'],
        required: true,
      ),
    ],
  ),
  'html-to-pdf': ToolPageSpec(
    titleKey: 'tools.html_to_pdf',
    subtitleKey: 'tools.html_to_pdf_desc',
    endpoint: '/api/v1/pdf/html-to-pdf-download',
    suggestedSuffix: '-rendered',
    formFields: [
      ToolFormField(
        id: 'url',
        label: 'URL',
        hint: 'https://example.com',
        required: true,
      ),
    ],
  ),
  'scan-to-pdf': ToolPageSpec(
    titleKey: 'tools.scan_to_pdf',
    subtitleKey: 'tools.scan_to_pdf_desc',
    endpoint: '/api/v1/pdf/scan-to-pdf-download',
    suggestedSuffix: '-scanned',
    formFields: [
      ToolFormField(
        id: 'lang',
        label: 'OCR language',
        type: FieldType.dropdown,
        options: const ['eng', 'spa', 'fra', 'deu', 'hin', 'ara'],
        required: true,
      ),
    ],
  ),
  'unlock': ToolPageSpec(
    titleKey: 'tools.unlock',
    subtitleKey: 'tools.unlock_desc',
    endpoint: '/api/v1/security/unlock-download',
    suggestedSuffix: '-unlocked',
    formFields: [
      ToolFormField(
        id: 'password',
        label: 'Current password (if any)',
      ),
    ],
  ),
  'watermark': ToolPageSpec(
    titleKey: 'tools.watermark',
    subtitleKey: 'tools.watermark_desc',
    endpoint: '/api/v1/pdf/watermark-download',
    suggestedSuffix: '-watermarked',
    formFields: [
      ToolFormField(
        id: 'text',
        label: 'Watermark text',
        required: true,
      ),
      ToolFormField(
        id: 'position',
        label: 'Position',
        type: FieldType.dropdown,
        options: const [
          'center', 'top-left', 'top-right', 'bottom-left', 'bottom-right',
        ],
        required: true,
      ),
      ToolFormField(id: 'opacity', label: 'Opacity (0-1)', hint: '0.1'),
    ],
  ),
  'sign': ToolPageSpec(
    titleKey: 'tools.sign',
    subtitleKey: 'tools.sign_desc',
    endpoint: '/api/v1/security/sign-download',
    suggestedSuffix: '-signed',
    formFields: [
      ToolFormField(
        id: 'name',
        label: 'Signer name',
        required: true,
      ),
      ToolFormField(
        id: 'date',
        label: 'Date text',
        hint: '2026-06-13',
      ),
    ],
  ),
  'redact': ToolPageSpec(
    titleKey: 'tools.redact',
    subtitleKey: 'tools.redact_desc',
    endpoint: '/api/v1/pdf/redact-download',
    suggestedSuffix: '-redacted',
    formFields: [
      ToolFormField(
        id: 'words',
        label: 'Words to redact (comma-separated)',
        hint: 'SSN,password',
        required: true,
      ),
    ],
  ),
  // Compare is intentionally NOT in this table — it
  // requires a second file picker, which the standard
  // page doesn't support. Until we build a two-file
  // variant, compare lands on the placeholder ("Coming
  // soon — open on web").
  'edit-pdf': ToolPageSpec(
    titleKey: 'tools.edit_pdf',
    subtitleKey: 'tools.edit_pdf_desc',
    endpoint: '/api/v1/security/edit-pdf-download',
    suggestedSuffix: '-edited',
    formFields: [
      ToolFormField(id: 'title', label: 'Title'),
      ToolFormField(id: 'author', label: 'Author'),
      ToolFormField(id: 'subject', label: 'Subject'),
      ToolFormField(id: 'keywords', label: 'Keywords'),
    ],
  ),
  'forms-extract': ToolPageSpec(
    titleKey: 'tools.forms_extract',
    subtitleKey: 'tools.forms_extract_desc',
    endpoint: '/api/v1/pdf/forms-extract-download',
    suggestedSuffix: '-forms',
    outputExtension: 'json',
    formFields: [],
  ),
  'pdf-to-pdfa': ToolPageSpec(
    titleKey: 'tools.pdf_to_pdfa',
    subtitleKey: 'tools.pdf_to_pdfa_desc',
    endpoint: '/api/v1/pdf/pdf-to-pdfa-download',
    suggestedSuffix: '-pdfa',
    formFields: [],
  ),
  'pdf-to-powerpoint': ToolPageSpec(
    titleKey: 'tools.pdf_to_powerpoint',
    subtitleKey: 'tools.pdf_to_powerpoint_desc',
    endpoint: '/api/v1/office/pdf-to-powerpoint-download',
    suggestedSuffix: '-converted',
    outputExtension: 'pptx',
    formFields: [],
  ),
  'pdf-to-excel': ToolPageSpec(
    titleKey: 'tools.pdf_to_excel',
    subtitleKey: 'tools.pdf_to_excel_desc',
    endpoint: '/api/v1/office/pdf-to-excel-download',
    suggestedSuffix: '-converted',
    outputExtension: 'xlsx',
    formFields: [],
  ),
  'word-to-pdf': ToolPageSpec(
    titleKey: 'tools.word_to_pdf',
    subtitleKey: 'tools.word_to_pdf_desc',
    endpoint: '/api/v1/office/word-to-pdf-download',
    suggestedSuffix: '-converted',
    formFields: [],
  ),
  'powerpoint-to-pdf': ToolPageSpec(
    titleKey: 'tools.powerpoint_to_pdf',
    subtitleKey: 'tools.powerpoint_to_pdf_desc',
    endpoint: '/api/v1/office/powerpoint-to-pdf-download',
    suggestedSuffix: '-converted',
    formFields: [],
  ),
  'excel-to-pdf': ToolPageSpec(
    titleKey: 'tools.excel_to_pdf',
    subtitleKey: 'tools.excel_to_pdf_desc',
    endpoint: '/api/v1/office/excel-to-pdf-download',
    suggestedSuffix: '-converted',
    formFields: [],
  ),
  'extract-tables': ToolPageSpec(
    titleKey: 'tools.extract_tables',
    subtitleKey: 'tools.extract_tables_desc',
    endpoint: '/api/v1/tables/extract-tables-download',
    suggestedSuffix: '-tables',
    outputExtension: 'csv',
    formFields: [
      ToolFormField(
        id: 'format',
        label: 'Output format',
        type: FieldType.dropdown,
        options: const ['csv', 'json'],
        required: true,
      ),
    ],
  ),
  'pdf-to-word': ToolPageSpec(
    titleKey: 'tools.pdf_to_word',
    subtitleKey: 'tools.pdf_to_word_desc',
    endpoint: '/api/v1/pdf/to-word-download',
    suggestedSuffix: '-converted',
    outputExtension: 'docx',
    formFields: [],
  ),
};

/// Build the [StandardToolPage] widget tree for a given tool
/// id. Returns null if the tool id isn't in [kSimpleToolPages].
Widget? buildSimpleToolPage(String toolId) {
  final spec = kSimpleToolPages[toolId];
  if (spec == null) return null;
  return _SpecToolPage(toolId: toolId, spec: spec);
}

/// Wraps [StandardToolPage] with i18n resolution from the spec.
class _SpecToolPage extends StatelessWidget {
  const _SpecToolPage({required this.toolId, required this.spec});
  final String toolId;
  final ToolPageSpec spec;

  @override
  Widget build(BuildContext context) {
    return StandardToolPage(
      title: spec.titleKey.tr(),
      subtitle: spec.subtitleKey.tr(),
      endpoint: spec.endpoint,
      formFields: spec.formFields,
      actionIcon: spec.actionIcon,
      suggestedFileSuffix: spec.suggestedSuffix ?? '-$toolId',
      outputExtension: spec.outputExtension,
      preSubmitValidation: spec.preSubmitValidation,
    );
  }
}
