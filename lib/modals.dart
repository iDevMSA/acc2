// lib/modals.dart
import 'package:flutter/material.dart';
import 'main.dart';

// ===================== 🟦 مودال إنشاء حساب جديد =====================
void showNewAccountModal(BuildContext context, VoidCallback onSaved) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => Directionality(
      textDirection: TextDirection.rtl,
      child: _NewAccountModal(onSaved: onSaved),
    ),
  );
}

class _NewAccountModal extends StatefulWidget {
  final VoidCallback onSaved;
  const _NewAccountModal({required this.onSaved});

  @override
  State<_NewAccountModal> createState() => __NewAccountModalState();
}

class __NewAccountModalState extends State<_NewAccountModal> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _classCtrl = TextEditingController();
  final _typeCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  String _selectedCurrency = 'ILS';
  final List<String> _currencies = ['ILS', 'USD', 'EGP'];
  final Map<String, String> _currencySymbols = {
    'ILS': '₪',
    'USD': '\$',
    'EGP': 'ج.م'
  };

  @override
  void dispose() {
    _nameCtrl.dispose();
    _classCtrl.dispose();
    _typeCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.85),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('حساب جديد',
                        style: TextStyle(
                            fontSize: 20, fontWeight: FontWeight.bold)),
                    CloseButton(),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      _buildField('اسم الحساب', _nameCtrl),
                      _buildField('تصنيف الحساب', _classCtrl),
                      _buildField('نوع الحساب', _typeCtrl),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: DropdownButtonFormField<String>(
                          value: _selectedCurrency,
                          decoration: InputDecoration(
                            labelText: 'عملة الحساب',
                            border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12)),
                            filled: true,
                            fillColor: Colors.grey.shade50,
                          ),
                          items: _currencies
                              .map((c) => DropdownMenuItem(
                                    value: c,
                                    child: Text('$c ${_currencySymbols[c]}'),
                                  ))
                              .toList(),
                          onChanged: (v) =>
                              setState(() => _selectedCurrency = v!),
                        ),
                      ),
                      _buildField('رقم هاتف الحساب', _phoneCtrl,
                          type: TextInputType.phone),
                      _buildField('العنوان', _addressCtrl, maxLines: 2),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () async {
                      if (_formKey.currentState!.validate()) {
                        final newAccount = Account(
                          id: DateTime.now().millisecondsSinceEpoch.toString(),
                          name: _nameCtrl.text,
                          category: _classCtrl.text,
                          type: _typeCtrl.text,
                          currency: _selectedCurrency,
                          phone: _phoneCtrl.text,
                          address: _addressCtrl.text,
                          balance: 0.0,
                        );
await DataService.addAccountWithSync(newAccount);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                  content: Text('تم إنشاء الحساب بنجاح ✅'),
                                  backgroundColor: Colors.green));
                          Navigator.pop(context);
                          widget.onSaved();
                        }
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF021B79),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('انشاء',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildField(String hint, TextEditingController ctrl,
      {TextInputType type = TextInputType.text, int maxLines = 1}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: ctrl,
        keyboardType: type,
        maxLines: maxLines,
        decoration: InputDecoration(
          hintText: hint,
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade300)),
          enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade300)),
          focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF021B79), width: 2)),
          filled: true,
          fillColor: Colors.grey.shade50,
        ),
        validator: (v) => v!.isEmpty ? 'هذا الحقل مطلوب' : null,
      ),
    );
  }
}

// ===================== 🟦 مودال تفاصيل الحساب =====================
void showAccountDetailModal(BuildContext context, Account account, VoidCallback onUpdated) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => Directionality(
      textDirection: TextDirection.rtl,
      child: _AccountDetailModal(account: account, onUpdated: onUpdated),
    ),
  );
}

class _AccountDetailModal extends StatefulWidget {
  final Account account;
  final VoidCallback onUpdated;
  const _AccountDetailModal({required this.account, required this.onUpdated});

  @override
  State<_AccountDetailModal> createState() => __AccountDetailModalState();
}

class __AccountDetailModalState extends State<_AccountDetailModal> {
  List<Entry> _entries = [];
  bool _isLoading = true;
  late Account _account;

  @override
  void initState() {
    super.initState();
    _account = widget.account;
    _loadEntries();
  }

  Future<void> _loadEntries() async {
    _entries = await DataService.getEntriesByAccount(_account.id);
    setState(() => _isLoading = false);
  }

  void _refresh() {
    _loadEntries();
    widget.onUpdated();
  }

  @override
  Widget build(BuildContext context) {
    final symbols = {'USD': '\$', 'ILS': '₪', 'EGP': 'ج.م'};
    final currencySymbol = symbols[_account.currency] ?? _account.currency;

    return Container(
      constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.9),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(_account.name,
                    style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF021B79))),
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit, color: Color(0xFF0575E6)),
                      tooltip: 'تعديل الحساب',
                      onPressed: () {
                        Navigator.pop(context);
                        showEditAccountModal(context, _account, () {
                          Navigator.pop(context);
                          showAccountDetailModal(
                              context, _account, widget.onUpdated);
                        });
                      },
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete, color: Colors.red),
                      tooltip: 'حذف الحساب',
                      onPressed: () => _confirmDeleteAccount(),
                    ),
                    const CloseButton(),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _infoRow('التصنيف', _account.category),
                _infoRow('النوع', _account.type),
                _infoRow('العملة', '${_account.currency} $currencySymbol'),
                if (_account.phone.isNotEmpty)
                  _infoRow('الهاتف', _account.phone),
                if (_account.address.isNotEmpty)
                  _infoRow('العنوان', _account.address),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF021B79).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('الرصيد الحالي',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                      Text(
                        '${_account.balance.toStringAsFixed(2)} $currencySymbol',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: _account.balance >= 0 ? Colors.green : Colors.red,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('قيود هذا الحساب',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                TextButton(
                  onPressed: () =>
                      showMultiEntryModal(context, _refresh, preselectedAccountId: _account.id),
                  child: const Text('+ إضافة قيد'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF021B79)))
                : _entries.isEmpty
                    ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(20),
                          child: Text('لا توجد قيود لهذا الحساب',
                              style: TextStyle(color: Colors.grey)),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _entries.length,
                        itemBuilder: (ctx, i) {
                          final entry = _entries[i];
                          final isPositive = entry.convertedAmount > 0;
                          return GestureDetector(
                            onTap: () => showEditEntryModal(context, entry, _refresh),
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.grey.shade50,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(entry.statement,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w500)),
                                        Text(
                                          entry.date.toString().substring(0, 16),
                                          style: TextStyle(
                                              fontSize: 11,
                                              color: Colors.grey.shade600),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    '${isPositive ? '+ ' : '- '}${entry.convertedAmount.abs().toStringAsFixed(2)} $currencySymbol',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: isPositive
                                          ? Colors.green
                                          : Colors.red,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Text('$label: ',
                style:
                    TextStyle(color: Colors.grey.shade600, fontSize: 13)),
            Text(value,
                style:
                    const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
          ],
        ),
      );

  void _confirmDeleteAccount() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('حذف الحساب'),
        content: Text(
            'هل أنت متأكد من حذف حساب "${_account.name}"؟ سيتم حذف جميع قيوده أيضاً.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('إلغاء'),
          ),
          ElevatedButton(
            onPressed: () async {
              await DataService.deleteAccount(_account.id);
              if (context.mounted) {
                Navigator.pop(context);
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                  content: Text('تم حذف الحساب ✅'),
                  backgroundColor: Colors.green,
                ));
                widget.onUpdated();
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('نعم، احذف',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}

// ===================== 🟦 مودال تعديل الحساب =====================
void showEditAccountModal(BuildContext context, Account account, VoidCallback onSaved) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => Directionality(
      textDirection: TextDirection.rtl,
      child: _EditAccountModal(account: account, onSaved: onSaved),
    ),
  );
}

class _EditAccountModal extends StatefulWidget {
  final Account account;
  final VoidCallback onSaved;
  const _EditAccountModal({required this.account, required this.onSaved});

  @override
  State<_EditAccountModal> createState() => __EditAccountModalState();
}

class __EditAccountModalState extends State<_EditAccountModal> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameCtrl, _classCtrl, _typeCtrl, _phoneCtrl, _addressCtrl;
  late String _selectedCurrency;
  final List<String> _currencies = ['ILS', 'USD', 'EGP'];
  final Map<String, String> _currencySymbols = {
    'ILS': '₪',
    'USD': '\$',
    'EGP': 'ج.م'
  };

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.account.name);
    _classCtrl = TextEditingController(text: widget.account.category);
    _typeCtrl = TextEditingController(text: widget.account.type);
    _phoneCtrl = TextEditingController(text: widget.account.phone);
    _addressCtrl = TextEditingController(text: widget.account.address);
    _selectedCurrency = widget.account.currency;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _classCtrl.dispose();
    _typeCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.85),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('تعديل الحساب',
                        style: TextStyle(
                            fontSize: 20, fontWeight: FontWeight.bold)),
                    CloseButton(),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      _buildField('اسم الحساب', _nameCtrl),
                      _buildField('تصنيف الحساب', _classCtrl),
                      _buildField('نوع الحساب', _typeCtrl),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: DropdownButtonFormField<String>(
                          value: _selectedCurrency,
                          decoration: InputDecoration(
                            labelText: 'عملة الحساب',
                            border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12)),
                            filled: true,
                            fillColor: Colors.grey.shade50,
                          ),
                          items: _currencies
                              .map((c) => DropdownMenuItem(
                                    value: c,
                                    child: Text('$c ${_currencySymbols[c]}'),
                                  ))
                              .toList(),
                          onChanged: (v) =>
                              setState(() => _selectedCurrency = v!),
                        ),
                      ),
                      _buildField('رقم هاتف الحساب', _phoneCtrl,
                          type: TextInputType.phone),
                      _buildField('العنوان', _addressCtrl, maxLines: 2),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () async {
                      if (_formKey.currentState!.validate()) {
                        final updated = Account(
                          id: widget.account.id,
                          name: _nameCtrl.text,
                          category: _classCtrl.text,
                          type: _typeCtrl.text,
                          currency: _selectedCurrency,
                          phone: _phoneCtrl.text,
                          address: _addressCtrl.text,
                          balance: widget.account.balance,
                        );
                        await DataService.updateAccount(updated);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                  content: Text('تم تحديث الحساب ✅'),
                                  backgroundColor: Colors.green));
                          Navigator.pop(context);
                          widget.onSaved();
                        }
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF021B79),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('حفظ التعديلات',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildField(String hint, TextEditingController ctrl,
      {TextInputType type = TextInputType.text, int maxLines = 1}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: ctrl,
        keyboardType: type,
        maxLines: maxLines,
        decoration: InputDecoration(
          hintText: hint,
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade300)),
          enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade300)),
          focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF021B79), width: 2)),
          filled: true,
          fillColor: Colors.grey.shade50,
        ),
        validator: (v) => v!.isEmpty ? 'هذا الحقل مطلوب' : null,
      ),
    );
  }
}

// ===================== 🟦 مودال قيد متعدد جديد =====================
void showMultiEntryModal(BuildContext context, VoidCallback onSaved, {String? preselectedAccountId}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => Directionality(
      textDirection: TextDirection.rtl,
      child: _MultiEntryModal(onSaved: onSaved, preselectedAccountId: preselectedAccountId),
    ),
  );
}

class _MultiEntryModal extends StatefulWidget {
  final VoidCallback onSaved;
  final String? preselectedAccountId;
  const _MultiEntryModal({required this.onSaved, this.preselectedAccountId});

  @override
  State<_MultiEntryModal> createState() => __MultiEntryModalState();
}

class __MultiEntryModalState extends State<_MultiEntryModal> {
  List<Account> _accounts = [];
  final List<Map<String, dynamic>> _entries = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadAccounts();
    _addEmptyEntry();
  }

  Future<void> _loadAccounts() async {
    _accounts = await DataService.getAccounts();
    if (widget.preselectedAccountId != null &&
        _accounts.any((a) => a.id == widget.preselectedAccountId)) {
      _addEmptyEntry(accountId: widget.preselectedAccountId);
    }
    setState(() => _isLoading = false);
  }

  void _addEmptyEntry({String? accountId}) {
    setState(() {
      _entries.add({
        'accountId': TextEditingController(text: accountId ?? ''),
        'accountName': '',
        'amount': TextEditingController(),
        'rate': TextEditingController(text: '1.0'),
        'statement': TextEditingController(),
        'currency': 'ILS',
        'convertedAmount': 0.0,
      });
    });
  }

  void _removeEntry(int index) {
    if (_entries.length > 1) {
      setState(() {
        _entries[index]['accountId'].dispose();
        _entries[index]['amount'].dispose();
        _entries[index]['rate'].dispose();
        _entries[index]['statement'].dispose();
        _entries.removeAt(index);
      });
    }
  }

  void _updateConvertedAmount(int index) {
    final amount = double.tryParse(_entries[index]['amount'].text) ?? 0;
    final rate = double.tryParse(_entries[index]['rate'].text) ?? 1;
    setState(() {
      _entries[index]['convertedAmount'] = rate != 0 ? amount / rate : 0;
    });
  }

  @override
  void dispose() {
    for (var e in _entries) {
      e['accountId'].dispose();
      e['amount'].dispose();
      e['rate'].dispose();
      e['statement'].dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.85),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(20),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('قيد متعدد جديد',
                      style:
                          TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  CloseButton(),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(color: Color(0xFF021B79)))
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _entries.length,
                      itemBuilder: (ctx, i) => _buildEntryRow(i, _entries[i]),
                    ),
            ),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 10)],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _addEmptyEntry,
                      icon: const Icon(Icons.add),
                      label: const Text('اضافة قيد اخر'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: const BorderSide(color: Color(0xFF021B79)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () async {
                        for (var e in _entries) {
                          if (e['accountId'].text.isEmpty ||
                              e['amount'].text.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content: Text('يرجى ملء جميع الحقول'),
                                    backgroundColor: Colors.orange));
                            return;
                          }
                        }
                        final entryData = _entries.map((e) => {
                          'accountId': e['accountId'].text,
                          'amount': double.tryParse(e['amount'].text) ?? 0,
                          'exchangeRate':
                              double.tryParse(e['rate'].text) ?? 1,
                          'statement': e['statement'].text,
                          'currency': e['currency'],
                        }).toList();

                        for (var data in entryData) {
                          final convertedAmount =
                              data['amount'] / data['exchangeRate'];
                          await DataService.addEntryWithSync(Entry(
                            id: DateTime.now().millisecondsSinceEpoch
                                    .toString() +
                                data['accountId'],
                            accountId: data['accountId'],
                            amount: data['amount'],
                            exchangeRate: data['exchangeRate'],
                            statement: data['statement'],
                            currency: data['currency'],
                            convertedAmount: convertedAmount,
                          ));
                        }
                        if (context.mounted) {
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                  content: Text(
                                      'تم حفظ القيود وتحديث الأرصدة ✅'),
                                  backgroundColor: Colors.green));
                          widget.onSaved();
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF021B79),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      child: const Text('حفظ وانشاء',
                          style: TextStyle(color: Colors.white)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEntryRow(int index, Map<String, dynamic> data) {
    final symbols = {'USD': '\$', 'ILS': '₪', 'EGP': 'ج.م'};
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('القيد #${index + 1}',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, color: Color(0xFF021B79))),
              if (_entries.length > 1)
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: Colors.red),
                  onPressed: () => _removeEntry(index),
                ),
            ],
          ),
          DropdownButtonFormField<String>(
            value: data['accountId'].text.isEmpty ? null : data['accountId'].text,
            decoration: InputDecoration(
              labelText: 'اختر الحساب',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              filled: true,
              fillColor: Colors.white,
            ),
            items: _accounts
                .map((acc) => DropdownMenuItem(
                      value: acc.id,
                      child: Text(
                          '${acc.name} (${acc.balance.toStringAsFixed(2)} ${symbols[acc.currency]})'),
                    ))
                .toList(),
            onChanged: (v) {
              if (v == null) return;
              final acc = _accounts.firstWhere((a) => a.id == v);
              setState(() {
                data['accountId'].text = v;
                data['accountName'] = acc.name;
                data['currency'] = acc.currency;
                data['rate'].text = acc.currency == 'ILS'
                    ? '1.0'
                    : (acc.currency == 'USD' ? '3.75' : '0.082');
                _updateConvertedAmount(index);
              });
            },
          ),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerRight,
            child: Text(
              'الرصيد الحالي: ${data['accountName'].isNotEmpty ? _accounts.firstWhere((a) => a.id == data['accountId'].text).balance.toStringAsFixed(2) : '0.00'} ${symbols[data['currency']] ?? data['currency']}',
              style: TextStyle(
                  color: Colors.green.shade700,
                  fontWeight: FontWeight.w500,
                  fontSize: 12),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _smallField('المبلغ (يمكن سالب)', data['amount'],
                    type: TextInputType.number,
                    onChanged: (_) => _updateConvertedAmount(index)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _smallField('سعر الصرف', data['rate'],
                    type: TextInputType.number,
                    onChanged: (_) => _updateConvertedAmount(index)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Align(
            alignment: Alignment.centerRight,
            child: Text(
              'المبلغ بعد التحويل: ${data['convertedAmount'].toStringAsFixed(2)} ${symbols[data['currency']] ?? data['currency']}',
              style: const TextStyle(
                  fontWeight: FontWeight.bold, color: Color(0xFF021B79)),
            ),
          ),
          const SizedBox(height: 8),
          _smallField('البيان', data['statement'], maxLines: 2),
        ],
      ),
    );
  }

  Widget _smallField(String hint, TextEditingController ctrl,
      {TextInputType type = TextInputType.text,
      int maxLines = 1,
      ValueChanged<String>? onChanged}) {
    return TextFormField(
      controller: ctrl,
      keyboardType: type,
      maxLines: maxLines,
      onChanged: onChanged,
      decoration: InputDecoration(
        hintText: hint,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        filled: true,
        fillColor: Colors.white,
        isDense: true,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
    );
  }
}

// ===================== 🟦 مودال تعديل/حذف قيد =====================
void showEditEntryModal(BuildContext context, Entry entry, VoidCallback onUpdated) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => Directionality(
      textDirection: TextDirection.rtl,
      child: _EditEntryModal(entry: entry, onUpdated: onUpdated),
    ),
  );
}

class _EditEntryModal extends StatefulWidget {
  final Entry entry;
  final VoidCallback onUpdated;
  const _EditEntryModal({required this.entry, required this.onUpdated});

  @override
  State<_EditEntryModal> createState() => __EditEntryModalState();
}

class __EditEntryModalState extends State<_EditEntryModal> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _amountCtrl, _rateCtrl, _statementCtrl;
  late String _currency;
  late double _convertedAmount;
  List<Account> _accounts = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _amountCtrl = TextEditingController(text: widget.entry.amount.toString());
    _rateCtrl = TextEditingController(text: widget.entry.exchangeRate.toString());
    _statementCtrl = TextEditingController(text: widget.entry.statement);
    _currency = widget.entry.currency;
    _convertedAmount = widget.entry.convertedAmount;
    _loadAccounts();
  }

  Future<void> _loadAccounts() async {
    _accounts = await DataService.getAccounts();
    setState(() => _isLoading = false);
  }

  void _updateConverted() {
    final amount = double.tryParse(_amountCtrl.text) ?? 0;
    final rate = double.tryParse(_rateCtrl.text) ?? 1;
    setState(() {
      _convertedAmount = rate != 0 ? amount / rate : 0;
    });
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _rateCtrl.dispose();
    _statementCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final symbols = {'USD': '\$', 'ILS': '₪', 'EGP': 'ج.م'};
    return Container(
      constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.85),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('تعديل القيد',
                        style: TextStyle(
                            fontSize: 20, fontWeight: FontWeight.bold)),
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.delete, color: Colors.red),
                          tooltip: 'حذف القيد',
                          onPressed: _confirmDeleteEntry,
                        ),
                        const CloseButton(),
                      ],
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      if (_isLoading)
                        const Center(
                            child:
                                CircularProgressIndicator(color: Color(0xFF021B79)))
                      else
                        DropdownButtonFormField<String>(
                          value: widget.entry.accountId,
                          decoration: InputDecoration(
                            labelText: 'الحساب',
                            border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12)),
                            filled: true,
                            fillColor: Colors.grey.shade50,
                          ),
                          items: _accounts
                              .map((acc) => DropdownMenuItem(
                                    value: acc.id,
                                    child: Text(
                                        '${acc.name} (${acc.balance.toStringAsFixed(2)} ${symbols[acc.currency]})'),
                                  ))
                              .toList(),
                          onChanged: null,
                        ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: _buildField('المبلغ', _amountCtrl,
                                type: TextInputType.number,
                                onChanged: (_) => _updateConverted()),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _buildField('سعر الصرف', _rateCtrl,
                                type: TextInputType.number,
                                onChanged: (_) => _updateConverted()),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerRight,
                        child: Text(
                          'المبلغ بعد التحويل: ${_convertedAmount.toStringAsFixed(2)} ${symbols[_currency] ?? _currency}',
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF021B79)),
                        ),
                      ),
                      const SizedBox(height: 12),
                      _buildField('البيان', _statementCtrl, maxLines: 3),
                      const SizedBox(height: 8),
                      Text(
                        'تاريخ القيد: ${widget.entry.date.toString().substring(0, 16)}',
                        style: TextStyle(
                            color: Colors.grey.shade600, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () {
                          Navigator.pop(context);
                        },
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          side: BorderSide(color: Colors.grey.shade300),
                        ),
                        child: const Text('إلغاء'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () async {
                          if (_formKey.currentState!.validate()) {
                            final updated = Entry(
                              id: widget.entry.id,
                              accountId: widget.entry.accountId,
                              amount: double.tryParse(_amountCtrl.text) ?? 0,
                              exchangeRate:
                                  double.tryParse(_rateCtrl.text) ?? 1,
                              statement: _statementCtrl.text,
                              currency: _currency,
                              convertedAmount: _convertedAmount,
                              date: widget.entry.date,
                            );
                            await DataService.updateEntry(updated);
                            if (context.mounted) {
                              Navigator.pop(context);
                              ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                      content: Text('تم تحديث القيد ✅'),
                                      backgroundColor: Colors.green));
                              widget.onUpdated();
                            }
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF021B79),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text('حفظ',
                            style: TextStyle(color: Colors.white)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildField(String hint, TextEditingController ctrl,
      {TextInputType type = TextInputType.text,
      int maxLines = 1,
      ValueChanged<String>? onChanged}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: ctrl,
        keyboardType: type,
        maxLines: maxLines,
        onChanged: onChanged,
        decoration: InputDecoration(
          hintText: hint,
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade300)),
          enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade300)),
          focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF021B79), width: 2)),
          filled: true,
          fillColor: Colors.grey.shade50,
        ),
        validator: (v) => v!.isEmpty ? 'هذا الحقل مطلوب' : null,
      ),
    );
  }

  void _confirmDeleteEntry() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('حذف القيد'),
        content: const Text(
            'هل أنت متأكد من حذف هذا القيد؟ سيتم تعديل رصيد الحساب تلقائياً.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('إلغاء'),
          ),
          ElevatedButton(
            onPressed: () async {
              await DataService.deleteEntry(widget.entry.id);
              if (context.mounted) {
                Navigator.pop(context);
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                  content: Text('تم حذف القيد ✅'),
                  backgroundColor: Colors.green,
                ));
                widget.onUpdated();
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('نعم، احذف',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}