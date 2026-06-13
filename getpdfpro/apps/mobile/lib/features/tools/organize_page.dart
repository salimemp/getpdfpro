import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';

import 'standard_tool_page.dart';

/// Organize pages tool — reorder/duplicate pages in a PDF.
/// The standard form is a comma-separated list of page
/// positions like `1,3,2,2,5` (you can repeat `2` to
/// duplicate page 2). Empty or single-page list is a no-op.
class OrganizePage extends StatefulWidget {
  const OrganizePage({super.key});

  @override
  State<OrganizePage> createState() => _OrganizePageState();
}

class _OrganizePageState extends State<OrganizePage> {
  final _orderController = TextEditingController();

  @override
  void dispose() {
    _orderController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return StandardToolPage(
      title: 'tools.organize'.tr(),
      subtitle: 'tools.organize_desc'.tr(),
      endpoint: '/api/v1/pdf/organize-download',
      suggestedFileSuffix: '-organized',
      submitLabel: 'Run',
      formFields: [
        ToolFormField(
          id: 'order',
          label: 'New page order',
          hint: 'e.g. 1,3,2,2,5 (repeat to duplicate)',
          required: true,
        ),
      ],
      preSubmitValidation: (v) =>
          (v['order'] as String).trim().isEmpty ? 'Enter page order' : null,
    );
  }
}
