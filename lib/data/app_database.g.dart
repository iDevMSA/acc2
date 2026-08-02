// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $AccountsTableTable extends AccountsTable
    with TableInfo<$AccountsTableTable, AccountsTableData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $AccountsTableTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _ownerUidMeta =
      const VerificationMeta('ownerUid');
  @override
  late final GeneratedColumn<String> ownerUid = GeneratedColumn<String>(
      'owner_uid', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
      'name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _phoneMeta = const VerificationMeta('phone');
  @override
  late final GeneratedColumn<String> phone = GeneratedColumn<String>(
      'phone', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant(''));
  static const VerificationMeta _addressMeta =
      const VerificationMeta('address');
  @override
  late final GeneratedColumn<String> address = GeneratedColumn<String>(
      'address', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant(''));
  static const VerificationMeta _typeMeta = const VerificationMeta('type');
  @override
  late final GeneratedColumn<String> type = GeneratedColumn<String>(
      'type', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('cash'));
  static const VerificationMeta _codeMeta = const VerificationMeta('code');
  @override
  late final GeneratedColumn<String> code = GeneratedColumn<String>(
      'code', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant(''));
  static const VerificationMeta _categoryMeta =
      const VerificationMeta('category');
  @override
  late final GeneratedColumn<String> category = GeneratedColumn<String>(
      'category', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('other'));
  static const VerificationMeta _allowClientLoginMeta =
      const VerificationMeta('allowClientLogin');
  @override
  late final GeneratedColumn<bool> allowClientLogin = GeneratedColumn<bool>(
      'allow_client_login', aliasedName, false,
      type: DriftSqlType.bool,
      requiredDuringInsert: false,
      defaultConstraints: GeneratedColumn.constraintIsAlways(
          'CHECK ("allow_client_login" IN (0, 1))'),
      defaultValue: const Constant(false));
  static const VerificationMeta _clientPhoneMeta =
      const VerificationMeta('clientPhone');
  @override
  late final GeneratedColumn<String> clientPhone = GeneratedColumn<String>(
      'client_phone', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant(''));
  static const VerificationMeta _clientEmailMeta =
      const VerificationMeta('clientEmail');
  @override
  late final GeneratedColumn<String> clientEmail = GeneratedColumn<String>(
      'client_email', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant(''));
  static const VerificationMeta _clientUidMeta =
      const VerificationMeta('clientUid');
  @override
  late final GeneratedColumn<String> clientUid = GeneratedColumn<String>(
      'client_uid', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant(''));
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        ownerUid,
        name,
        phone,
        address,
        type,
        code,
        category,
        allowClientLogin,
        clientPhone,
        clientEmail,
        clientUid,
        createdAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'accounts';
  @override
  VerificationContext validateIntegrity(Insertable<AccountsTableData> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner_uid')) {
      context.handle(_ownerUidMeta,
          ownerUid.isAcceptableOrUnknown(data['owner_uid']!, _ownerUidMeta));
    } else if (isInserting) {
      context.missing(_ownerUidMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
          _nameMeta, name.isAcceptableOrUnknown(data['name']!, _nameMeta));
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('phone')) {
      context.handle(
          _phoneMeta, phone.isAcceptableOrUnknown(data['phone']!, _phoneMeta));
    }
    if (data.containsKey('address')) {
      context.handle(_addressMeta,
          address.isAcceptableOrUnknown(data['address']!, _addressMeta));
    }
    if (data.containsKey('type')) {
      context.handle(
          _typeMeta, type.isAcceptableOrUnknown(data['type']!, _typeMeta));
    }
    if (data.containsKey('code')) {
      context.handle(
          _codeMeta, code.isAcceptableOrUnknown(data['code']!, _codeMeta));
    }
    if (data.containsKey('category')) {
      context.handle(_categoryMeta,
          category.isAcceptableOrUnknown(data['category']!, _categoryMeta));
    }
    if (data.containsKey('allow_client_login')) {
      context.handle(
          _allowClientLoginMeta,
          allowClientLogin.isAcceptableOrUnknown(
              data['allow_client_login']!, _allowClientLoginMeta));
    }
    if (data.containsKey('client_phone')) {
      context.handle(
          _clientPhoneMeta,
          clientPhone.isAcceptableOrUnknown(
              data['client_phone']!, _clientPhoneMeta));
    }
    if (data.containsKey('client_email')) {
      context.handle(
          _clientEmailMeta,
          clientEmail.isAcceptableOrUnknown(
              data['client_email']!, _clientEmailMeta));
    }
    if (data.containsKey('client_uid')) {
      context.handle(_clientUidMeta,
          clientUid.isAcceptableOrUnknown(data['client_uid']!, _clientUidMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {ownerUid, id};
  @override
  AccountsTableData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return AccountsTableData(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      ownerUid: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_uid'])!,
      name: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}name'])!,
      phone: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}phone'])!,
      address: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}address'])!,
      type: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}type'])!,
      code: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}code'])!,
      category: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}category'])!,
      allowClientLogin: attachedDatabase.typeMapping.read(
          DriftSqlType.bool, data['${effectivePrefix}allow_client_login'])!,
      clientPhone: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}client_phone'])!,
      clientEmail: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}client_email'])!,
      clientUid: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}client_uid'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
    );
  }

  @override
  $AccountsTableTable createAlias(String alias) {
    return $AccountsTableTable(attachedDatabase, alias);
  }
}

class AccountsTableData extends DataClass
    implements Insertable<AccountsTableData> {
  final String id;
  final String ownerUid;
  final String name;
  final String phone;
  final String address;
  final String type;
  final String code;
  final String category;
  final bool allowClientLogin;
  final String clientPhone;
  final String clientEmail;
  final String clientUid;
  final DateTime createdAt;
  const AccountsTableData(
      {required this.id,
      required this.ownerUid,
      required this.name,
      required this.phone,
      required this.address,
      required this.type,
      required this.code,
      required this.category,
      required this.allowClientLogin,
      required this.clientPhone,
      required this.clientEmail,
      required this.clientUid,
      required this.createdAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner_uid'] = Variable<String>(ownerUid);
    map['name'] = Variable<String>(name);
    map['phone'] = Variable<String>(phone);
    map['address'] = Variable<String>(address);
    map['type'] = Variable<String>(type);
    map['code'] = Variable<String>(code);
    map['category'] = Variable<String>(category);
    map['allow_client_login'] = Variable<bool>(allowClientLogin);
    map['client_phone'] = Variable<String>(clientPhone);
    map['client_email'] = Variable<String>(clientEmail);
    map['client_uid'] = Variable<String>(clientUid);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  AccountsTableCompanion toCompanion(bool nullToAbsent) {
    return AccountsTableCompanion(
      id: Value(id),
      ownerUid: Value(ownerUid),
      name: Value(name),
      phone: Value(phone),
      address: Value(address),
      type: Value(type),
      code: Value(code),
      category: Value(category),
      allowClientLogin: Value(allowClientLogin),
      clientPhone: Value(clientPhone),
      clientEmail: Value(clientEmail),
      clientUid: Value(clientUid),
      createdAt: Value(createdAt),
    );
  }

  factory AccountsTableData.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return AccountsTableData(
      id: serializer.fromJson<String>(json['id']),
      ownerUid: serializer.fromJson<String>(json['ownerUid']),
      name: serializer.fromJson<String>(json['name']),
      phone: serializer.fromJson<String>(json['phone']),
      address: serializer.fromJson<String>(json['address']),
      type: serializer.fromJson<String>(json['type']),
      code: serializer.fromJson<String>(json['code']),
      category: serializer.fromJson<String>(json['category']),
      allowClientLogin: serializer.fromJson<bool>(json['allowClientLogin']),
      clientPhone: serializer.fromJson<String>(json['clientPhone']),
      clientEmail: serializer.fromJson<String>(json['clientEmail']),
      clientUid: serializer.fromJson<String>(json['clientUid']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ownerUid': serializer.toJson<String>(ownerUid),
      'name': serializer.toJson<String>(name),
      'phone': serializer.toJson<String>(phone),
      'address': serializer.toJson<String>(address),
      'type': serializer.toJson<String>(type),
      'code': serializer.toJson<String>(code),
      'category': serializer.toJson<String>(category),
      'allowClientLogin': serializer.toJson<bool>(allowClientLogin),
      'clientPhone': serializer.toJson<String>(clientPhone),
      'clientEmail': serializer.toJson<String>(clientEmail),
      'clientUid': serializer.toJson<String>(clientUid),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  AccountsTableData copyWith(
          {String? id,
          String? ownerUid,
          String? name,
          String? phone,
          String? address,
          String? type,
          String? code,
          String? category,
          bool? allowClientLogin,
          String? clientPhone,
          String? clientEmail,
          String? clientUid,
          DateTime? createdAt}) =>
      AccountsTableData(
        id: id ?? this.id,
        ownerUid: ownerUid ?? this.ownerUid,
        name: name ?? this.name,
        phone: phone ?? this.phone,
        address: address ?? this.address,
        type: type ?? this.type,
        code: code ?? this.code,
        category: category ?? this.category,
        allowClientLogin: allowClientLogin ?? this.allowClientLogin,
        clientPhone: clientPhone ?? this.clientPhone,
        clientEmail: clientEmail ?? this.clientEmail,
        clientUid: clientUid ?? this.clientUid,
        createdAt: createdAt ?? this.createdAt,
      );
  AccountsTableData copyWithCompanion(AccountsTableCompanion data) {
    return AccountsTableData(
      id: data.id.present ? data.id.value : this.id,
      ownerUid: data.ownerUid.present ? data.ownerUid.value : this.ownerUid,
      name: data.name.present ? data.name.value : this.name,
      phone: data.phone.present ? data.phone.value : this.phone,
      address: data.address.present ? data.address.value : this.address,
      type: data.type.present ? data.type.value : this.type,
      code: data.code.present ? data.code.value : this.code,
      category: data.category.present ? data.category.value : this.category,
      allowClientLogin: data.allowClientLogin.present
          ? data.allowClientLogin.value
          : this.allowClientLogin,
      clientPhone:
          data.clientPhone.present ? data.clientPhone.value : this.clientPhone,
      clientEmail:
          data.clientEmail.present ? data.clientEmail.value : this.clientEmail,
      clientUid: data.clientUid.present ? data.clientUid.value : this.clientUid,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('AccountsTableData(')
          ..write('id: $id, ')
          ..write('ownerUid: $ownerUid, ')
          ..write('name: $name, ')
          ..write('phone: $phone, ')
          ..write('address: $address, ')
          ..write('type: $type, ')
          ..write('code: $code, ')
          ..write('category: $category, ')
          ..write('allowClientLogin: $allowClientLogin, ')
          ..write('clientPhone: $clientPhone, ')
          ..write('clientEmail: $clientEmail, ')
          ..write('clientUid: $clientUid, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id,
      ownerUid,
      name,
      phone,
      address,
      type,
      code,
      category,
      allowClientLogin,
      clientPhone,
      clientEmail,
      clientUid,
      createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is AccountsTableData &&
          other.id == this.id &&
          other.ownerUid == this.ownerUid &&
          other.name == this.name &&
          other.phone == this.phone &&
          other.address == this.address &&
          other.type == this.type &&
          other.code == this.code &&
          other.category == this.category &&
          other.allowClientLogin == this.allowClientLogin &&
          other.clientPhone == this.clientPhone &&
          other.clientEmail == this.clientEmail &&
          other.clientUid == this.clientUid &&
          other.createdAt == this.createdAt);
}

class AccountsTableCompanion extends UpdateCompanion<AccountsTableData> {
  final Value<String> id;
  final Value<String> ownerUid;
  final Value<String> name;
  final Value<String> phone;
  final Value<String> address;
  final Value<String> type;
  final Value<String> code;
  final Value<String> category;
  final Value<bool> allowClientLogin;
  final Value<String> clientPhone;
  final Value<String> clientEmail;
  final Value<String> clientUid;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const AccountsTableCompanion({
    this.id = const Value.absent(),
    this.ownerUid = const Value.absent(),
    this.name = const Value.absent(),
    this.phone = const Value.absent(),
    this.address = const Value.absent(),
    this.type = const Value.absent(),
    this.code = const Value.absent(),
    this.category = const Value.absent(),
    this.allowClientLogin = const Value.absent(),
    this.clientPhone = const Value.absent(),
    this.clientEmail = const Value.absent(),
    this.clientUid = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  AccountsTableCompanion.insert({
    required String id,
    required String ownerUid,
    required String name,
    this.phone = const Value.absent(),
    this.address = const Value.absent(),
    this.type = const Value.absent(),
    this.code = const Value.absent(),
    this.category = const Value.absent(),
    this.allowClientLogin = const Value.absent(),
    this.clientPhone = const Value.absent(),
    this.clientEmail = const Value.absent(),
    this.clientUid = const Value.absent(),
    required DateTime createdAt,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        ownerUid = Value(ownerUid),
        name = Value(name),
        createdAt = Value(createdAt);
  static Insertable<AccountsTableData> custom({
    Expression<String>? id,
    Expression<String>? ownerUid,
    Expression<String>? name,
    Expression<String>? phone,
    Expression<String>? address,
    Expression<String>? type,
    Expression<String>? code,
    Expression<String>? category,
    Expression<bool>? allowClientLogin,
    Expression<String>? clientPhone,
    Expression<String>? clientEmail,
    Expression<String>? clientUid,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ownerUid != null) 'owner_uid': ownerUid,
      if (name != null) 'name': name,
      if (phone != null) 'phone': phone,
      if (address != null) 'address': address,
      if (type != null) 'type': type,
      if (code != null) 'code': code,
      if (category != null) 'category': category,
      if (allowClientLogin != null) 'allow_client_login': allowClientLogin,
      if (clientPhone != null) 'client_phone': clientPhone,
      if (clientEmail != null) 'client_email': clientEmail,
      if (clientUid != null) 'client_uid': clientUid,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  AccountsTableCompanion copyWith(
      {Value<String>? id,
      Value<String>? ownerUid,
      Value<String>? name,
      Value<String>? phone,
      Value<String>? address,
      Value<String>? type,
      Value<String>? code,
      Value<String>? category,
      Value<bool>? allowClientLogin,
      Value<String>? clientPhone,
      Value<String>? clientEmail,
      Value<String>? clientUid,
      Value<DateTime>? createdAt,
      Value<int>? rowid}) {
    return AccountsTableCompanion(
      id: id ?? this.id,
      ownerUid: ownerUid ?? this.ownerUid,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      address: address ?? this.address,
      type: type ?? this.type,
      code: code ?? this.code,
      category: category ?? this.category,
      allowClientLogin: allowClientLogin ?? this.allowClientLogin,
      clientPhone: clientPhone ?? this.clientPhone,
      clientEmail: clientEmail ?? this.clientEmail,
      clientUid: clientUid ?? this.clientUid,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ownerUid.present) {
      map['owner_uid'] = Variable<String>(ownerUid.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (phone.present) {
      map['phone'] = Variable<String>(phone.value);
    }
    if (address.present) {
      map['address'] = Variable<String>(address.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(type.value);
    }
    if (code.present) {
      map['code'] = Variable<String>(code.value);
    }
    if (category.present) {
      map['category'] = Variable<String>(category.value);
    }
    if (allowClientLogin.present) {
      map['allow_client_login'] = Variable<bool>(allowClientLogin.value);
    }
    if (clientPhone.present) {
      map['client_phone'] = Variable<String>(clientPhone.value);
    }
    if (clientEmail.present) {
      map['client_email'] = Variable<String>(clientEmail.value);
    }
    if (clientUid.present) {
      map['client_uid'] = Variable<String>(clientUid.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('AccountsTableCompanion(')
          ..write('id: $id, ')
          ..write('ownerUid: $ownerUid, ')
          ..write('name: $name, ')
          ..write('phone: $phone, ')
          ..write('address: $address, ')
          ..write('type: $type, ')
          ..write('code: $code, ')
          ..write('category: $category, ')
          ..write('allowClientLogin: $allowClientLogin, ')
          ..write('clientPhone: $clientPhone, ')
          ..write('clientEmail: $clientEmail, ')
          ..write('clientUid: $clientUid, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $OperationsTableTable extends OperationsTable
    with TableInfo<$OperationsTableTable, OperationsTableData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OperationsTableTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _ownerUidMeta =
      const VerificationMeta('ownerUid');
  @override
  late final GeneratedColumn<String> ownerUid = GeneratedColumn<String>(
      'owner_uid', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _accountIdMeta =
      const VerificationMeta('accountId');
  @override
  late final GeneratedColumn<String> accountId = GeneratedColumn<String>(
      'account_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _amountMeta = const VerificationMeta('amount');
  @override
  late final GeneratedColumn<double> amount = GeneratedColumn<double>(
      'amount', aliasedName, false,
      type: DriftSqlType.double, requiredDuringInsert: true);
  static const VerificationMeta _exchangeRateMeta =
      const VerificationMeta('exchangeRate');
  @override
  late final GeneratedColumn<double> exchangeRate = GeneratedColumn<double>(
      'exchange_rate', aliasedName, false,
      type: DriftSqlType.double,
      requiredDuringInsert: false,
      defaultValue: const Constant(1));
  static const VerificationMeta _currencyMeta =
      const VerificationMeta('currency');
  @override
  late final GeneratedColumn<String> currency = GeneratedColumn<String>(
      'currency', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('USD'));
  static const VerificationMeta _amountUSDMeta =
      const VerificationMeta('amountUSD');
  @override
  late final GeneratedColumn<double> amountUSD = GeneratedColumn<double>(
      'amount_u_s_d', aliasedName, false,
      type: DriftSqlType.double, requiredDuringInsert: true);
  static const VerificationMeta _statementMeta =
      const VerificationMeta('statement');
  @override
  late final GeneratedColumn<String> statement = GeneratedColumn<String>(
      'statement', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant(''));
  static const VerificationMeta _dateMeta = const VerificationMeta('date');
  @override
  late final GeneratedColumn<DateTime> date = GeneratedColumn<DateTime>(
      'date', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _sourceMeta = const VerificationMeta('source');
  @override
  late final GeneratedColumn<String> source = GeneratedColumn<String>(
      'source', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        ownerUid,
        accountId,
        amount,
        exchangeRate,
        currency,
        amountUSD,
        statement,
        date,
        source
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'operations';
  @override
  VerificationContext validateIntegrity(
      Insertable<OperationsTableData> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner_uid')) {
      context.handle(_ownerUidMeta,
          ownerUid.isAcceptableOrUnknown(data['owner_uid']!, _ownerUidMeta));
    } else if (isInserting) {
      context.missing(_ownerUidMeta);
    }
    if (data.containsKey('account_id')) {
      context.handle(_accountIdMeta,
          accountId.isAcceptableOrUnknown(data['account_id']!, _accountIdMeta));
    } else if (isInserting) {
      context.missing(_accountIdMeta);
    }
    if (data.containsKey('amount')) {
      context.handle(_amountMeta,
          amount.isAcceptableOrUnknown(data['amount']!, _amountMeta));
    } else if (isInserting) {
      context.missing(_amountMeta);
    }
    if (data.containsKey('exchange_rate')) {
      context.handle(
          _exchangeRateMeta,
          exchangeRate.isAcceptableOrUnknown(
              data['exchange_rate']!, _exchangeRateMeta));
    }
    if (data.containsKey('currency')) {
      context.handle(_currencyMeta,
          currency.isAcceptableOrUnknown(data['currency']!, _currencyMeta));
    }
    if (data.containsKey('amount_u_s_d')) {
      context.handle(
          _amountUSDMeta,
          amountUSD.isAcceptableOrUnknown(
              data['amount_u_s_d']!, _amountUSDMeta));
    } else if (isInserting) {
      context.missing(_amountUSDMeta);
    }
    if (data.containsKey('statement')) {
      context.handle(_statementMeta,
          statement.isAcceptableOrUnknown(data['statement']!, _statementMeta));
    }
    if (data.containsKey('date')) {
      context.handle(
          _dateMeta, date.isAcceptableOrUnknown(data['date']!, _dateMeta));
    } else if (isInserting) {
      context.missing(_dateMeta);
    }
    if (data.containsKey('source')) {
      context.handle(_sourceMeta,
          source.isAcceptableOrUnknown(data['source']!, _sourceMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {ownerUid, id};
  @override
  OperationsTableData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OperationsTableData(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      ownerUid: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_uid'])!,
      accountId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}account_id'])!,
      amount: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}amount'])!,
      exchangeRate: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}exchange_rate'])!,
      currency: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}currency'])!,
      amountUSD: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}amount_u_s_d'])!,
      statement: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}statement'])!,
      date: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}date'])!,
      source: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}source']),
    );
  }

  @override
  $OperationsTableTable createAlias(String alias) {
    return $OperationsTableTable(attachedDatabase, alias);
  }
}

class OperationsTableData extends DataClass
    implements Insertable<OperationsTableData> {
  final String id;
  final String ownerUid;
  final String accountId;
  final double amount;
  final double exchangeRate;
  final String currency;
  final double amountUSD;
  final String statement;
  final DateTime date;
  final String? source;
  const OperationsTableData(
      {required this.id,
      required this.ownerUid,
      required this.accountId,
      required this.amount,
      required this.exchangeRate,
      required this.currency,
      required this.amountUSD,
      required this.statement,
      required this.date,
      this.source});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner_uid'] = Variable<String>(ownerUid);
    map['account_id'] = Variable<String>(accountId);
    map['amount'] = Variable<double>(amount);
    map['exchange_rate'] = Variable<double>(exchangeRate);
    map['currency'] = Variable<String>(currency);
    map['amount_u_s_d'] = Variable<double>(amountUSD);
    map['statement'] = Variable<String>(statement);
    map['date'] = Variable<DateTime>(date);
    if (!nullToAbsent || source != null) {
      map['source'] = Variable<String>(source);
    }
    return map;
  }

  OperationsTableCompanion toCompanion(bool nullToAbsent) {
    return OperationsTableCompanion(
      id: Value(id),
      ownerUid: Value(ownerUid),
      accountId: Value(accountId),
      amount: Value(amount),
      exchangeRate: Value(exchangeRate),
      currency: Value(currency),
      amountUSD: Value(amountUSD),
      statement: Value(statement),
      date: Value(date),
      source:
          source == null && nullToAbsent ? const Value.absent() : Value(source),
    );
  }

  factory OperationsTableData.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OperationsTableData(
      id: serializer.fromJson<String>(json['id']),
      ownerUid: serializer.fromJson<String>(json['ownerUid']),
      accountId: serializer.fromJson<String>(json['accountId']),
      amount: serializer.fromJson<double>(json['amount']),
      exchangeRate: serializer.fromJson<double>(json['exchangeRate']),
      currency: serializer.fromJson<String>(json['currency']),
      amountUSD: serializer.fromJson<double>(json['amountUSD']),
      statement: serializer.fromJson<String>(json['statement']),
      date: serializer.fromJson<DateTime>(json['date']),
      source: serializer.fromJson<String?>(json['source']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'ownerUid': serializer.toJson<String>(ownerUid),
      'accountId': serializer.toJson<String>(accountId),
      'amount': serializer.toJson<double>(amount),
      'exchangeRate': serializer.toJson<double>(exchangeRate),
      'currency': serializer.toJson<String>(currency),
      'amountUSD': serializer.toJson<double>(amountUSD),
      'statement': serializer.toJson<String>(statement),
      'date': serializer.toJson<DateTime>(date),
      'source': serializer.toJson<String?>(source),
    };
  }

  OperationsTableData copyWith(
          {String? id,
          String? ownerUid,
          String? accountId,
          double? amount,
          double? exchangeRate,
          String? currency,
          double? amountUSD,
          String? statement,
          DateTime? date,
          Value<String?> source = const Value.absent()}) =>
      OperationsTableData(
        id: id ?? this.id,
        ownerUid: ownerUid ?? this.ownerUid,
        accountId: accountId ?? this.accountId,
        amount: amount ?? this.amount,
        exchangeRate: exchangeRate ?? this.exchangeRate,
        currency: currency ?? this.currency,
        amountUSD: amountUSD ?? this.amountUSD,
        statement: statement ?? this.statement,
        date: date ?? this.date,
        source: source.present ? source.value : this.source,
      );
  OperationsTableData copyWithCompanion(OperationsTableCompanion data) {
    return OperationsTableData(
      id: data.id.present ? data.id.value : this.id,
      ownerUid: data.ownerUid.present ? data.ownerUid.value : this.ownerUid,
      accountId: data.accountId.present ? data.accountId.value : this.accountId,
      amount: data.amount.present ? data.amount.value : this.amount,
      exchangeRate: data.exchangeRate.present
          ? data.exchangeRate.value
          : this.exchangeRate,
      currency: data.currency.present ? data.currency.value : this.currency,
      amountUSD: data.amountUSD.present ? data.amountUSD.value : this.amountUSD,
      statement: data.statement.present ? data.statement.value : this.statement,
      date: data.date.present ? data.date.value : this.date,
      source: data.source.present ? data.source.value : this.source,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OperationsTableData(')
          ..write('id: $id, ')
          ..write('ownerUid: $ownerUid, ')
          ..write('accountId: $accountId, ')
          ..write('amount: $amount, ')
          ..write('exchangeRate: $exchangeRate, ')
          ..write('currency: $currency, ')
          ..write('amountUSD: $amountUSD, ')
          ..write('statement: $statement, ')
          ..write('date: $date, ')
          ..write('source: $source')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, ownerUid, accountId, amount, exchangeRate,
      currency, amountUSD, statement, date, source);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OperationsTableData &&
          other.id == this.id &&
          other.ownerUid == this.ownerUid &&
          other.accountId == this.accountId &&
          other.amount == this.amount &&
          other.exchangeRate == this.exchangeRate &&
          other.currency == this.currency &&
          other.amountUSD == this.amountUSD &&
          other.statement == this.statement &&
          other.date == this.date &&
          other.source == this.source);
}

class OperationsTableCompanion extends UpdateCompanion<OperationsTableData> {
  final Value<String> id;
  final Value<String> ownerUid;
  final Value<String> accountId;
  final Value<double> amount;
  final Value<double> exchangeRate;
  final Value<String> currency;
  final Value<double> amountUSD;
  final Value<String> statement;
  final Value<DateTime> date;
  final Value<String?> source;
  final Value<int> rowid;
  const OperationsTableCompanion({
    this.id = const Value.absent(),
    this.ownerUid = const Value.absent(),
    this.accountId = const Value.absent(),
    this.amount = const Value.absent(),
    this.exchangeRate = const Value.absent(),
    this.currency = const Value.absent(),
    this.amountUSD = const Value.absent(),
    this.statement = const Value.absent(),
    this.date = const Value.absent(),
    this.source = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  OperationsTableCompanion.insert({
    required String id,
    required String ownerUid,
    required String accountId,
    required double amount,
    this.exchangeRate = const Value.absent(),
    this.currency = const Value.absent(),
    required double amountUSD,
    this.statement = const Value.absent(),
    required DateTime date,
    this.source = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        ownerUid = Value(ownerUid),
        accountId = Value(accountId),
        amount = Value(amount),
        amountUSD = Value(amountUSD),
        date = Value(date);
  static Insertable<OperationsTableData> custom({
    Expression<String>? id,
    Expression<String>? ownerUid,
    Expression<String>? accountId,
    Expression<double>? amount,
    Expression<double>? exchangeRate,
    Expression<String>? currency,
    Expression<double>? amountUSD,
    Expression<String>? statement,
    Expression<DateTime>? date,
    Expression<String>? source,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (ownerUid != null) 'owner_uid': ownerUid,
      if (accountId != null) 'account_id': accountId,
      if (amount != null) 'amount': amount,
      if (exchangeRate != null) 'exchange_rate': exchangeRate,
      if (currency != null) 'currency': currency,
      if (amountUSD != null) 'amount_u_s_d': amountUSD,
      if (statement != null) 'statement': statement,
      if (date != null) 'date': date,
      if (source != null) 'source': source,
      if (rowid != null) 'rowid': rowid,
    });
  }

  OperationsTableCompanion copyWith(
      {Value<String>? id,
      Value<String>? ownerUid,
      Value<String>? accountId,
      Value<double>? amount,
      Value<double>? exchangeRate,
      Value<String>? currency,
      Value<double>? amountUSD,
      Value<String>? statement,
      Value<DateTime>? date,
      Value<String?>? source,
      Value<int>? rowid}) {
    return OperationsTableCompanion(
      id: id ?? this.id,
      ownerUid: ownerUid ?? this.ownerUid,
      accountId: accountId ?? this.accountId,
      amount: amount ?? this.amount,
      exchangeRate: exchangeRate ?? this.exchangeRate,
      currency: currency ?? this.currency,
      amountUSD: amountUSD ?? this.amountUSD,
      statement: statement ?? this.statement,
      date: date ?? this.date,
      source: source ?? this.source,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (ownerUid.present) {
      map['owner_uid'] = Variable<String>(ownerUid.value);
    }
    if (accountId.present) {
      map['account_id'] = Variable<String>(accountId.value);
    }
    if (amount.present) {
      map['amount'] = Variable<double>(amount.value);
    }
    if (exchangeRate.present) {
      map['exchange_rate'] = Variable<double>(exchangeRate.value);
    }
    if (currency.present) {
      map['currency'] = Variable<String>(currency.value);
    }
    if (amountUSD.present) {
      map['amount_u_s_d'] = Variable<double>(amountUSD.value);
    }
    if (statement.present) {
      map['statement'] = Variable<String>(statement.value);
    }
    if (date.present) {
      map['date'] = Variable<DateTime>(date.value);
    }
    if (source.present) {
      map['source'] = Variable<String>(source.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OperationsTableCompanion(')
          ..write('id: $id, ')
          ..write('ownerUid: $ownerUid, ')
          ..write('accountId: $accountId, ')
          ..write('amount: $amount, ')
          ..write('exchangeRate: $exchangeRate, ')
          ..write('currency: $currency, ')
          ..write('amountUSD: $amountUSD, ')
          ..write('statement: $statement, ')
          ..write('date: $date, ')
          ..write('source: $source, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $PendingSyncItemsTable extends PendingSyncItems
    with TableInfo<$PendingSyncItemsTable, PendingSyncItem> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PendingSyncItemsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _ownerUidMeta =
      const VerificationMeta('ownerUid');
  @override
  late final GeneratedColumn<String> ownerUid = GeneratedColumn<String>(
      'owner_uid', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _entityMeta = const VerificationMeta('entity');
  @override
  late final GeneratedColumn<String> entity = GeneratedColumn<String>(
      'entity', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _entityIdMeta =
      const VerificationMeta('entityId');
  @override
  late final GeneratedColumn<String> entityId = GeneratedColumn<String>(
      'entity_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _actionMeta = const VerificationMeta('action');
  @override
  late final GeneratedColumn<String> action = GeneratedColumn<String>(
      'action', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _dataJsonMeta =
      const VerificationMeta('dataJson');
  @override
  late final GeneratedColumn<String> dataJson = GeneratedColumn<String>(
      'data_json', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _tsMeta = const VerificationMeta('ts');
  @override
  late final GeneratedColumn<DateTime> ts = GeneratedColumn<DateTime>(
      'ts', aliasedName, false,
      type: DriftSqlType.dateTime,
      requiredDuringInsert: false,
      defaultValue: currentDateAndTime);
  @override
  List<GeneratedColumn> get $columns =>
      [ownerUid, entity, entityId, action, dataJson, ts];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'pending_sync_items';
  @override
  VerificationContext validateIntegrity(Insertable<PendingSyncItem> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('owner_uid')) {
      context.handle(_ownerUidMeta,
          ownerUid.isAcceptableOrUnknown(data['owner_uid']!, _ownerUidMeta));
    } else if (isInserting) {
      context.missing(_ownerUidMeta);
    }
    if (data.containsKey('entity')) {
      context.handle(_entityMeta,
          entity.isAcceptableOrUnknown(data['entity']!, _entityMeta));
    } else if (isInserting) {
      context.missing(_entityMeta);
    }
    if (data.containsKey('entity_id')) {
      context.handle(_entityIdMeta,
          entityId.isAcceptableOrUnknown(data['entity_id']!, _entityIdMeta));
    } else if (isInserting) {
      context.missing(_entityIdMeta);
    }
    if (data.containsKey('action')) {
      context.handle(_actionMeta,
          action.isAcceptableOrUnknown(data['action']!, _actionMeta));
    } else if (isInserting) {
      context.missing(_actionMeta);
    }
    if (data.containsKey('data_json')) {
      context.handle(_dataJsonMeta,
          dataJson.isAcceptableOrUnknown(data['data_json']!, _dataJsonMeta));
    } else if (isInserting) {
      context.missing(_dataJsonMeta);
    }
    if (data.containsKey('ts')) {
      context.handle(_tsMeta, ts.isAcceptableOrUnknown(data['ts']!, _tsMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {ownerUid, entity, entityId};
  @override
  PendingSyncItem map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PendingSyncItem(
      ownerUid: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_uid'])!,
      entity: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}entity'])!,
      entityId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}entity_id'])!,
      action: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}action'])!,
      dataJson: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}data_json'])!,
      ts: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}ts'])!,
    );
  }

  @override
  $PendingSyncItemsTable createAlias(String alias) {
    return $PendingSyncItemsTable(attachedDatabase, alias);
  }
}

class PendingSyncItem extends DataClass implements Insertable<PendingSyncItem> {
  final String ownerUid;
  final String entity;
  final String entityId;
  final String action;
  final String dataJson;
  final DateTime ts;
  const PendingSyncItem(
      {required this.ownerUid,
      required this.entity,
      required this.entityId,
      required this.action,
      required this.dataJson,
      required this.ts});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['owner_uid'] = Variable<String>(ownerUid);
    map['entity'] = Variable<String>(entity);
    map['entity_id'] = Variable<String>(entityId);
    map['action'] = Variable<String>(action);
    map['data_json'] = Variable<String>(dataJson);
    map['ts'] = Variable<DateTime>(ts);
    return map;
  }

  PendingSyncItemsCompanion toCompanion(bool nullToAbsent) {
    return PendingSyncItemsCompanion(
      ownerUid: Value(ownerUid),
      entity: Value(entity),
      entityId: Value(entityId),
      action: Value(action),
      dataJson: Value(dataJson),
      ts: Value(ts),
    );
  }

  factory PendingSyncItem.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PendingSyncItem(
      ownerUid: serializer.fromJson<String>(json['ownerUid']),
      entity: serializer.fromJson<String>(json['entity']),
      entityId: serializer.fromJson<String>(json['entityId']),
      action: serializer.fromJson<String>(json['action']),
      dataJson: serializer.fromJson<String>(json['dataJson']),
      ts: serializer.fromJson<DateTime>(json['ts']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'ownerUid': serializer.toJson<String>(ownerUid),
      'entity': serializer.toJson<String>(entity),
      'entityId': serializer.toJson<String>(entityId),
      'action': serializer.toJson<String>(action),
      'dataJson': serializer.toJson<String>(dataJson),
      'ts': serializer.toJson<DateTime>(ts),
    };
  }

  PendingSyncItem copyWith(
          {String? ownerUid,
          String? entity,
          String? entityId,
          String? action,
          String? dataJson,
          DateTime? ts}) =>
      PendingSyncItem(
        ownerUid: ownerUid ?? this.ownerUid,
        entity: entity ?? this.entity,
        entityId: entityId ?? this.entityId,
        action: action ?? this.action,
        dataJson: dataJson ?? this.dataJson,
        ts: ts ?? this.ts,
      );
  PendingSyncItem copyWithCompanion(PendingSyncItemsCompanion data) {
    return PendingSyncItem(
      ownerUid: data.ownerUid.present ? data.ownerUid.value : this.ownerUid,
      entity: data.entity.present ? data.entity.value : this.entity,
      entityId: data.entityId.present ? data.entityId.value : this.entityId,
      action: data.action.present ? data.action.value : this.action,
      dataJson: data.dataJson.present ? data.dataJson.value : this.dataJson,
      ts: data.ts.present ? data.ts.value : this.ts,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PendingSyncItem(')
          ..write('ownerUid: $ownerUid, ')
          ..write('entity: $entity, ')
          ..write('entityId: $entityId, ')
          ..write('action: $action, ')
          ..write('dataJson: $dataJson, ')
          ..write('ts: $ts')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(ownerUid, entity, entityId, action, dataJson, ts);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PendingSyncItem &&
          other.ownerUid == this.ownerUid &&
          other.entity == this.entity &&
          other.entityId == this.entityId &&
          other.action == this.action &&
          other.dataJson == this.dataJson &&
          other.ts == this.ts);
}

class PendingSyncItemsCompanion extends UpdateCompanion<PendingSyncItem> {
  final Value<String> ownerUid;
  final Value<String> entity;
  final Value<String> entityId;
  final Value<String> action;
  final Value<String> dataJson;
  final Value<DateTime> ts;
  final Value<int> rowid;
  const PendingSyncItemsCompanion({
    this.ownerUid = const Value.absent(),
    this.entity = const Value.absent(),
    this.entityId = const Value.absent(),
    this.action = const Value.absent(),
    this.dataJson = const Value.absent(),
    this.ts = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  PendingSyncItemsCompanion.insert({
    required String ownerUid,
    required String entity,
    required String entityId,
    required String action,
    required String dataJson,
    this.ts = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : ownerUid = Value(ownerUid),
        entity = Value(entity),
        entityId = Value(entityId),
        action = Value(action),
        dataJson = Value(dataJson);
  static Insertable<PendingSyncItem> custom({
    Expression<String>? ownerUid,
    Expression<String>? entity,
    Expression<String>? entityId,
    Expression<String>? action,
    Expression<String>? dataJson,
    Expression<DateTime>? ts,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (ownerUid != null) 'owner_uid': ownerUid,
      if (entity != null) 'entity': entity,
      if (entityId != null) 'entity_id': entityId,
      if (action != null) 'action': action,
      if (dataJson != null) 'data_json': dataJson,
      if (ts != null) 'ts': ts,
      if (rowid != null) 'rowid': rowid,
    });
  }

  PendingSyncItemsCompanion copyWith(
      {Value<String>? ownerUid,
      Value<String>? entity,
      Value<String>? entityId,
      Value<String>? action,
      Value<String>? dataJson,
      Value<DateTime>? ts,
      Value<int>? rowid}) {
    return PendingSyncItemsCompanion(
      ownerUid: ownerUid ?? this.ownerUid,
      entity: entity ?? this.entity,
      entityId: entityId ?? this.entityId,
      action: action ?? this.action,
      dataJson: dataJson ?? this.dataJson,
      ts: ts ?? this.ts,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (ownerUid.present) {
      map['owner_uid'] = Variable<String>(ownerUid.value);
    }
    if (entity.present) {
      map['entity'] = Variable<String>(entity.value);
    }
    if (entityId.present) {
      map['entity_id'] = Variable<String>(entityId.value);
    }
    if (action.present) {
      map['action'] = Variable<String>(action.value);
    }
    if (dataJson.present) {
      map['data_json'] = Variable<String>(dataJson.value);
    }
    if (ts.present) {
      map['ts'] = Variable<DateTime>(ts.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PendingSyncItemsCompanion(')
          ..write('ownerUid: $ownerUid, ')
          ..write('entity: $entity, ')
          ..write('entityId: $entityId, ')
          ..write('action: $action, ')
          ..write('dataJson: $dataJson, ')
          ..write('ts: $ts, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SyncCursorsTable extends SyncCursors
    with TableInfo<$SyncCursorsTable, SyncCursor> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SyncCursorsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _ownerUidMeta =
      const VerificationMeta('ownerUid');
  @override
  late final GeneratedColumn<String> ownerUid = GeneratedColumn<String>(
      'owner_uid', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _nodeMeta = const VerificationMeta('node');
  @override
  late final GeneratedColumn<String> node = GeneratedColumn<String>(
      'node', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _lastSyncedAtMeta =
      const VerificationMeta('lastSyncedAt');
  @override
  late final GeneratedColumn<DateTime> lastSyncedAt = GeneratedColumn<DateTime>(
      'last_synced_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [ownerUid, node, lastSyncedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sync_cursors';
  @override
  VerificationContext validateIntegrity(Insertable<SyncCursor> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('owner_uid')) {
      context.handle(_ownerUidMeta,
          ownerUid.isAcceptableOrUnknown(data['owner_uid']!, _ownerUidMeta));
    } else if (isInserting) {
      context.missing(_ownerUidMeta);
    }
    if (data.containsKey('node')) {
      context.handle(
          _nodeMeta, node.isAcceptableOrUnknown(data['node']!, _nodeMeta));
    } else if (isInserting) {
      context.missing(_nodeMeta);
    }
    if (data.containsKey('last_synced_at')) {
      context.handle(
          _lastSyncedAtMeta,
          lastSyncedAt.isAcceptableOrUnknown(
              data['last_synced_at']!, _lastSyncedAtMeta));
    } else if (isInserting) {
      context.missing(_lastSyncedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {ownerUid, node};
  @override
  SyncCursor map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SyncCursor(
      ownerUid: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_uid'])!,
      node: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}node'])!,
      lastSyncedAt: attachedDatabase.typeMapping.read(
          DriftSqlType.dateTime, data['${effectivePrefix}last_synced_at'])!,
    );
  }

  @override
  $SyncCursorsTable createAlias(String alias) {
    return $SyncCursorsTable(attachedDatabase, alias);
  }
}

class SyncCursor extends DataClass implements Insertable<SyncCursor> {
  final String ownerUid;
  final String node;
  final DateTime lastSyncedAt;
  const SyncCursor(
      {required this.ownerUid, required this.node, required this.lastSyncedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['owner_uid'] = Variable<String>(ownerUid);
    map['node'] = Variable<String>(node);
    map['last_synced_at'] = Variable<DateTime>(lastSyncedAt);
    return map;
  }

  SyncCursorsCompanion toCompanion(bool nullToAbsent) {
    return SyncCursorsCompanion(
      ownerUid: Value(ownerUid),
      node: Value(node),
      lastSyncedAt: Value(lastSyncedAt),
    );
  }

  factory SyncCursor.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SyncCursor(
      ownerUid: serializer.fromJson<String>(json['ownerUid']),
      node: serializer.fromJson<String>(json['node']),
      lastSyncedAt: serializer.fromJson<DateTime>(json['lastSyncedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'ownerUid': serializer.toJson<String>(ownerUid),
      'node': serializer.toJson<String>(node),
      'lastSyncedAt': serializer.toJson<DateTime>(lastSyncedAt),
    };
  }

  SyncCursor copyWith(
          {String? ownerUid, String? node, DateTime? lastSyncedAt}) =>
      SyncCursor(
        ownerUid: ownerUid ?? this.ownerUid,
        node: node ?? this.node,
        lastSyncedAt: lastSyncedAt ?? this.lastSyncedAt,
      );
  SyncCursor copyWithCompanion(SyncCursorsCompanion data) {
    return SyncCursor(
      ownerUid: data.ownerUid.present ? data.ownerUid.value : this.ownerUid,
      node: data.node.present ? data.node.value : this.node,
      lastSyncedAt: data.lastSyncedAt.present
          ? data.lastSyncedAt.value
          : this.lastSyncedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SyncCursor(')
          ..write('ownerUid: $ownerUid, ')
          ..write('node: $node, ')
          ..write('lastSyncedAt: $lastSyncedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(ownerUid, node, lastSyncedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SyncCursor &&
          other.ownerUid == this.ownerUid &&
          other.node == this.node &&
          other.lastSyncedAt == this.lastSyncedAt);
}

class SyncCursorsCompanion extends UpdateCompanion<SyncCursor> {
  final Value<String> ownerUid;
  final Value<String> node;
  final Value<DateTime> lastSyncedAt;
  final Value<int> rowid;
  const SyncCursorsCompanion({
    this.ownerUid = const Value.absent(),
    this.node = const Value.absent(),
    this.lastSyncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  SyncCursorsCompanion.insert({
    required String ownerUid,
    required String node,
    required DateTime lastSyncedAt,
    this.rowid = const Value.absent(),
  })  : ownerUid = Value(ownerUid),
        node = Value(node),
        lastSyncedAt = Value(lastSyncedAt);
  static Insertable<SyncCursor> custom({
    Expression<String>? ownerUid,
    Expression<String>? node,
    Expression<DateTime>? lastSyncedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (ownerUid != null) 'owner_uid': ownerUid,
      if (node != null) 'node': node,
      if (lastSyncedAt != null) 'last_synced_at': lastSyncedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  SyncCursorsCompanion copyWith(
      {Value<String>? ownerUid,
      Value<String>? node,
      Value<DateTime>? lastSyncedAt,
      Value<int>? rowid}) {
    return SyncCursorsCompanion(
      ownerUid: ownerUid ?? this.ownerUid,
      node: node ?? this.node,
      lastSyncedAt: lastSyncedAt ?? this.lastSyncedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (ownerUid.present) {
      map['owner_uid'] = Variable<String>(ownerUid.value);
    }
    if (node.present) {
      map['node'] = Variable<String>(node.value);
    }
    if (lastSyncedAt.present) {
      map['last_synced_at'] = Variable<DateTime>(lastSyncedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SyncCursorsCompanion(')
          ..write('ownerUid: $ownerUid, ')
          ..write('node: $node, ')
          ..write('lastSyncedAt: $lastSyncedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $AccountsTableTable accountsTable = $AccountsTableTable(this);
  late final $OperationsTableTable operationsTable =
      $OperationsTableTable(this);
  late final $PendingSyncItemsTable pendingSyncItems =
      $PendingSyncItemsTable(this);
  late final $SyncCursorsTable syncCursors = $SyncCursorsTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities =>
      [accountsTable, operationsTable, pendingSyncItems, syncCursors];
}

typedef $$AccountsTableTableCreateCompanionBuilder = AccountsTableCompanion
    Function({
  required String id,
  required String ownerUid,
  required String name,
  Value<String> phone,
  Value<String> address,
  Value<String> type,
  Value<String> code,
  Value<String> category,
  Value<bool> allowClientLogin,
  Value<String> clientPhone,
  Value<String> clientEmail,
  Value<String> clientUid,
  required DateTime createdAt,
  Value<int> rowid,
});
typedef $$AccountsTableTableUpdateCompanionBuilder = AccountsTableCompanion
    Function({
  Value<String> id,
  Value<String> ownerUid,
  Value<String> name,
  Value<String> phone,
  Value<String> address,
  Value<String> type,
  Value<String> code,
  Value<String> category,
  Value<bool> allowClientLogin,
  Value<String> clientPhone,
  Value<String> clientEmail,
  Value<String> clientUid,
  Value<DateTime> createdAt,
  Value<int> rowid,
});

class $$AccountsTableTableFilterComposer
    extends Composer<_$AppDatabase, $AccountsTableTable> {
  $$AccountsTableTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerUid => $composableBuilder(
      column: $table.ownerUid, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get phone => $composableBuilder(
      column: $table.phone, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get address => $composableBuilder(
      column: $table.address, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get type => $composableBuilder(
      column: $table.type, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get code => $composableBuilder(
      column: $table.code, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get category => $composableBuilder(
      column: $table.category, builder: (column) => ColumnFilters(column));

  ColumnFilters<bool> get allowClientLogin => $composableBuilder(
      column: $table.allowClientLogin,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get clientPhone => $composableBuilder(
      column: $table.clientPhone, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get clientEmail => $composableBuilder(
      column: $table.clientEmail, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get clientUid => $composableBuilder(
      column: $table.clientUid, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));
}

class $$AccountsTableTableOrderingComposer
    extends Composer<_$AppDatabase, $AccountsTableTable> {
  $$AccountsTableTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerUid => $composableBuilder(
      column: $table.ownerUid, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get phone => $composableBuilder(
      column: $table.phone, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get address => $composableBuilder(
      column: $table.address, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get type => $composableBuilder(
      column: $table.type, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get code => $composableBuilder(
      column: $table.code, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get category => $composableBuilder(
      column: $table.category, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<bool> get allowClientLogin => $composableBuilder(
      column: $table.allowClientLogin,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get clientPhone => $composableBuilder(
      column: $table.clientPhone, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get clientEmail => $composableBuilder(
      column: $table.clientEmail, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get clientUid => $composableBuilder(
      column: $table.clientUid, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));
}

class $$AccountsTableTableAnnotationComposer
    extends Composer<_$AppDatabase, $AccountsTableTable> {
  $$AccountsTableTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ownerUid =>
      $composableBuilder(column: $table.ownerUid, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get phone =>
      $composableBuilder(column: $table.phone, builder: (column) => column);

  GeneratedColumn<String> get address =>
      $composableBuilder(column: $table.address, builder: (column) => column);

  GeneratedColumn<String> get type =>
      $composableBuilder(column: $table.type, builder: (column) => column);

  GeneratedColumn<String> get code =>
      $composableBuilder(column: $table.code, builder: (column) => column);

  GeneratedColumn<String> get category =>
      $composableBuilder(column: $table.category, builder: (column) => column);

  GeneratedColumn<bool> get allowClientLogin => $composableBuilder(
      column: $table.allowClientLogin, builder: (column) => column);

  GeneratedColumn<String> get clientPhone => $composableBuilder(
      column: $table.clientPhone, builder: (column) => column);

  GeneratedColumn<String> get clientEmail => $composableBuilder(
      column: $table.clientEmail, builder: (column) => column);

  GeneratedColumn<String> get clientUid =>
      $composableBuilder(column: $table.clientUid, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$AccountsTableTableTableManager extends RootTableManager<
    _$AppDatabase,
    $AccountsTableTable,
    AccountsTableData,
    $$AccountsTableTableFilterComposer,
    $$AccountsTableTableOrderingComposer,
    $$AccountsTableTableAnnotationComposer,
    $$AccountsTableTableCreateCompanionBuilder,
    $$AccountsTableTableUpdateCompanionBuilder,
    (
      AccountsTableData,
      BaseReferences<_$AppDatabase, $AccountsTableTable, AccountsTableData>
    ),
    AccountsTableData,
    PrefetchHooks Function()> {
  $$AccountsTableTableTableManager(_$AppDatabase db, $AccountsTableTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$AccountsTableTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$AccountsTableTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$AccountsTableTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> ownerUid = const Value.absent(),
            Value<String> name = const Value.absent(),
            Value<String> phone = const Value.absent(),
            Value<String> address = const Value.absent(),
            Value<String> type = const Value.absent(),
            Value<String> code = const Value.absent(),
            Value<String> category = const Value.absent(),
            Value<bool> allowClientLogin = const Value.absent(),
            Value<String> clientPhone = const Value.absent(),
            Value<String> clientEmail = const Value.absent(),
            Value<String> clientUid = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              AccountsTableCompanion(
            id: id,
            ownerUid: ownerUid,
            name: name,
            phone: phone,
            address: address,
            type: type,
            code: code,
            category: category,
            allowClientLogin: allowClientLogin,
            clientPhone: clientPhone,
            clientEmail: clientEmail,
            clientUid: clientUid,
            createdAt: createdAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String ownerUid,
            required String name,
            Value<String> phone = const Value.absent(),
            Value<String> address = const Value.absent(),
            Value<String> type = const Value.absent(),
            Value<String> code = const Value.absent(),
            Value<String> category = const Value.absent(),
            Value<bool> allowClientLogin = const Value.absent(),
            Value<String> clientPhone = const Value.absent(),
            Value<String> clientEmail = const Value.absent(),
            Value<String> clientUid = const Value.absent(),
            required DateTime createdAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              AccountsTableCompanion.insert(
            id: id,
            ownerUid: ownerUid,
            name: name,
            phone: phone,
            address: address,
            type: type,
            code: code,
            category: category,
            allowClientLogin: allowClientLogin,
            clientPhone: clientPhone,
            clientEmail: clientEmail,
            clientUid: clientUid,
            createdAt: createdAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$AccountsTableTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $AccountsTableTable,
    AccountsTableData,
    $$AccountsTableTableFilterComposer,
    $$AccountsTableTableOrderingComposer,
    $$AccountsTableTableAnnotationComposer,
    $$AccountsTableTableCreateCompanionBuilder,
    $$AccountsTableTableUpdateCompanionBuilder,
    (
      AccountsTableData,
      BaseReferences<_$AppDatabase, $AccountsTableTable, AccountsTableData>
    ),
    AccountsTableData,
    PrefetchHooks Function()>;
typedef $$OperationsTableTableCreateCompanionBuilder = OperationsTableCompanion
    Function({
  required String id,
  required String ownerUid,
  required String accountId,
  required double amount,
  Value<double> exchangeRate,
  Value<String> currency,
  required double amountUSD,
  Value<String> statement,
  required DateTime date,
  Value<String?> source,
  Value<int> rowid,
});
typedef $$OperationsTableTableUpdateCompanionBuilder = OperationsTableCompanion
    Function({
  Value<String> id,
  Value<String> ownerUid,
  Value<String> accountId,
  Value<double> amount,
  Value<double> exchangeRate,
  Value<String> currency,
  Value<double> amountUSD,
  Value<String> statement,
  Value<DateTime> date,
  Value<String?> source,
  Value<int> rowid,
});

class $$OperationsTableTableFilterComposer
    extends Composer<_$AppDatabase, $OperationsTableTable> {
  $$OperationsTableTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerUid => $composableBuilder(
      column: $table.ownerUid, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get accountId => $composableBuilder(
      column: $table.accountId, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get amount => $composableBuilder(
      column: $table.amount, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get exchangeRate => $composableBuilder(
      column: $table.exchangeRate, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get currency => $composableBuilder(
      column: $table.currency, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get amountUSD => $composableBuilder(
      column: $table.amountUSD, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get statement => $composableBuilder(
      column: $table.statement, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get date => $composableBuilder(
      column: $table.date, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get source => $composableBuilder(
      column: $table.source, builder: (column) => ColumnFilters(column));
}

class $$OperationsTableTableOrderingComposer
    extends Composer<_$AppDatabase, $OperationsTableTable> {
  $$OperationsTableTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerUid => $composableBuilder(
      column: $table.ownerUid, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get accountId => $composableBuilder(
      column: $table.accountId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get amount => $composableBuilder(
      column: $table.amount, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get exchangeRate => $composableBuilder(
      column: $table.exchangeRate,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get currency => $composableBuilder(
      column: $table.currency, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get amountUSD => $composableBuilder(
      column: $table.amountUSD, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get statement => $composableBuilder(
      column: $table.statement, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get date => $composableBuilder(
      column: $table.date, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get source => $composableBuilder(
      column: $table.source, builder: (column) => ColumnOrderings(column));
}

class $$OperationsTableTableAnnotationComposer
    extends Composer<_$AppDatabase, $OperationsTableTable> {
  $$OperationsTableTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get ownerUid =>
      $composableBuilder(column: $table.ownerUid, builder: (column) => column);

  GeneratedColumn<String> get accountId =>
      $composableBuilder(column: $table.accountId, builder: (column) => column);

  GeneratedColumn<double> get amount =>
      $composableBuilder(column: $table.amount, builder: (column) => column);

  GeneratedColumn<double> get exchangeRate => $composableBuilder(
      column: $table.exchangeRate, builder: (column) => column);

  GeneratedColumn<String> get currency =>
      $composableBuilder(column: $table.currency, builder: (column) => column);

  GeneratedColumn<double> get amountUSD =>
      $composableBuilder(column: $table.amountUSD, builder: (column) => column);

  GeneratedColumn<String> get statement =>
      $composableBuilder(column: $table.statement, builder: (column) => column);

  GeneratedColumn<DateTime> get date =>
      $composableBuilder(column: $table.date, builder: (column) => column);

  GeneratedColumn<String> get source =>
      $composableBuilder(column: $table.source, builder: (column) => column);
}

class $$OperationsTableTableTableManager extends RootTableManager<
    _$AppDatabase,
    $OperationsTableTable,
    OperationsTableData,
    $$OperationsTableTableFilterComposer,
    $$OperationsTableTableOrderingComposer,
    $$OperationsTableTableAnnotationComposer,
    $$OperationsTableTableCreateCompanionBuilder,
    $$OperationsTableTableUpdateCompanionBuilder,
    (
      OperationsTableData,
      BaseReferences<_$AppDatabase, $OperationsTableTable, OperationsTableData>
    ),
    OperationsTableData,
    PrefetchHooks Function()> {
  $$OperationsTableTableTableManager(
      _$AppDatabase db, $OperationsTableTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OperationsTableTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OperationsTableTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OperationsTableTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> ownerUid = const Value.absent(),
            Value<String> accountId = const Value.absent(),
            Value<double> amount = const Value.absent(),
            Value<double> exchangeRate = const Value.absent(),
            Value<String> currency = const Value.absent(),
            Value<double> amountUSD = const Value.absent(),
            Value<String> statement = const Value.absent(),
            Value<DateTime> date = const Value.absent(),
            Value<String?> source = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              OperationsTableCompanion(
            id: id,
            ownerUid: ownerUid,
            accountId: accountId,
            amount: amount,
            exchangeRate: exchangeRate,
            currency: currency,
            amountUSD: amountUSD,
            statement: statement,
            date: date,
            source: source,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String ownerUid,
            required String accountId,
            required double amount,
            Value<double> exchangeRate = const Value.absent(),
            Value<String> currency = const Value.absent(),
            required double amountUSD,
            Value<String> statement = const Value.absent(),
            required DateTime date,
            Value<String?> source = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              OperationsTableCompanion.insert(
            id: id,
            ownerUid: ownerUid,
            accountId: accountId,
            amount: amount,
            exchangeRate: exchangeRate,
            currency: currency,
            amountUSD: amountUSD,
            statement: statement,
            date: date,
            source: source,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$OperationsTableTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $OperationsTableTable,
    OperationsTableData,
    $$OperationsTableTableFilterComposer,
    $$OperationsTableTableOrderingComposer,
    $$OperationsTableTableAnnotationComposer,
    $$OperationsTableTableCreateCompanionBuilder,
    $$OperationsTableTableUpdateCompanionBuilder,
    (
      OperationsTableData,
      BaseReferences<_$AppDatabase, $OperationsTableTable, OperationsTableData>
    ),
    OperationsTableData,
    PrefetchHooks Function()>;
typedef $$PendingSyncItemsTableCreateCompanionBuilder
    = PendingSyncItemsCompanion Function({
  required String ownerUid,
  required String entity,
  required String entityId,
  required String action,
  required String dataJson,
  Value<DateTime> ts,
  Value<int> rowid,
});
typedef $$PendingSyncItemsTableUpdateCompanionBuilder
    = PendingSyncItemsCompanion Function({
  Value<String> ownerUid,
  Value<String> entity,
  Value<String> entityId,
  Value<String> action,
  Value<String> dataJson,
  Value<DateTime> ts,
  Value<int> rowid,
});

class $$PendingSyncItemsTableFilterComposer
    extends Composer<_$AppDatabase, $PendingSyncItemsTable> {
  $$PendingSyncItemsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get ownerUid => $composableBuilder(
      column: $table.ownerUid, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get entity => $composableBuilder(
      column: $table.entity, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get entityId => $composableBuilder(
      column: $table.entityId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get action => $composableBuilder(
      column: $table.action, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get dataJson => $composableBuilder(
      column: $table.dataJson, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get ts => $composableBuilder(
      column: $table.ts, builder: (column) => ColumnFilters(column));
}

class $$PendingSyncItemsTableOrderingComposer
    extends Composer<_$AppDatabase, $PendingSyncItemsTable> {
  $$PendingSyncItemsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get ownerUid => $composableBuilder(
      column: $table.ownerUid, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get entity => $composableBuilder(
      column: $table.entity, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get entityId => $composableBuilder(
      column: $table.entityId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get action => $composableBuilder(
      column: $table.action, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get dataJson => $composableBuilder(
      column: $table.dataJson, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get ts => $composableBuilder(
      column: $table.ts, builder: (column) => ColumnOrderings(column));
}

class $$PendingSyncItemsTableAnnotationComposer
    extends Composer<_$AppDatabase, $PendingSyncItemsTable> {
  $$PendingSyncItemsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get ownerUid =>
      $composableBuilder(column: $table.ownerUid, builder: (column) => column);

  GeneratedColumn<String> get entity =>
      $composableBuilder(column: $table.entity, builder: (column) => column);

  GeneratedColumn<String> get entityId =>
      $composableBuilder(column: $table.entityId, builder: (column) => column);

  GeneratedColumn<String> get action =>
      $composableBuilder(column: $table.action, builder: (column) => column);

  GeneratedColumn<String> get dataJson =>
      $composableBuilder(column: $table.dataJson, builder: (column) => column);

  GeneratedColumn<DateTime> get ts =>
      $composableBuilder(column: $table.ts, builder: (column) => column);
}

class $$PendingSyncItemsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $PendingSyncItemsTable,
    PendingSyncItem,
    $$PendingSyncItemsTableFilterComposer,
    $$PendingSyncItemsTableOrderingComposer,
    $$PendingSyncItemsTableAnnotationComposer,
    $$PendingSyncItemsTableCreateCompanionBuilder,
    $$PendingSyncItemsTableUpdateCompanionBuilder,
    (
      PendingSyncItem,
      BaseReferences<_$AppDatabase, $PendingSyncItemsTable, PendingSyncItem>
    ),
    PendingSyncItem,
    PrefetchHooks Function()> {
  $$PendingSyncItemsTableTableManager(
      _$AppDatabase db, $PendingSyncItemsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$PendingSyncItemsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$PendingSyncItemsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PendingSyncItemsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> ownerUid = const Value.absent(),
            Value<String> entity = const Value.absent(),
            Value<String> entityId = const Value.absent(),
            Value<String> action = const Value.absent(),
            Value<String> dataJson = const Value.absent(),
            Value<DateTime> ts = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              PendingSyncItemsCompanion(
            ownerUid: ownerUid,
            entity: entity,
            entityId: entityId,
            action: action,
            dataJson: dataJson,
            ts: ts,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String ownerUid,
            required String entity,
            required String entityId,
            required String action,
            required String dataJson,
            Value<DateTime> ts = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              PendingSyncItemsCompanion.insert(
            ownerUid: ownerUid,
            entity: entity,
            entityId: entityId,
            action: action,
            dataJson: dataJson,
            ts: ts,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$PendingSyncItemsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $PendingSyncItemsTable,
    PendingSyncItem,
    $$PendingSyncItemsTableFilterComposer,
    $$PendingSyncItemsTableOrderingComposer,
    $$PendingSyncItemsTableAnnotationComposer,
    $$PendingSyncItemsTableCreateCompanionBuilder,
    $$PendingSyncItemsTableUpdateCompanionBuilder,
    (
      PendingSyncItem,
      BaseReferences<_$AppDatabase, $PendingSyncItemsTable, PendingSyncItem>
    ),
    PendingSyncItem,
    PrefetchHooks Function()>;
typedef $$SyncCursorsTableCreateCompanionBuilder = SyncCursorsCompanion
    Function({
  required String ownerUid,
  required String node,
  required DateTime lastSyncedAt,
  Value<int> rowid,
});
typedef $$SyncCursorsTableUpdateCompanionBuilder = SyncCursorsCompanion
    Function({
  Value<String> ownerUid,
  Value<String> node,
  Value<DateTime> lastSyncedAt,
  Value<int> rowid,
});

class $$SyncCursorsTableFilterComposer
    extends Composer<_$AppDatabase, $SyncCursorsTable> {
  $$SyncCursorsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get ownerUid => $composableBuilder(
      column: $table.ownerUid, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get node => $composableBuilder(
      column: $table.node, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get lastSyncedAt => $composableBuilder(
      column: $table.lastSyncedAt, builder: (column) => ColumnFilters(column));
}

class $$SyncCursorsTableOrderingComposer
    extends Composer<_$AppDatabase, $SyncCursorsTable> {
  $$SyncCursorsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get ownerUid => $composableBuilder(
      column: $table.ownerUid, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get node => $composableBuilder(
      column: $table.node, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get lastSyncedAt => $composableBuilder(
      column: $table.lastSyncedAt,
      builder: (column) => ColumnOrderings(column));
}

class $$SyncCursorsTableAnnotationComposer
    extends Composer<_$AppDatabase, $SyncCursorsTable> {
  $$SyncCursorsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get ownerUid =>
      $composableBuilder(column: $table.ownerUid, builder: (column) => column);

  GeneratedColumn<String> get node =>
      $composableBuilder(column: $table.node, builder: (column) => column);

  GeneratedColumn<DateTime> get lastSyncedAt => $composableBuilder(
      column: $table.lastSyncedAt, builder: (column) => column);
}

class $$SyncCursorsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $SyncCursorsTable,
    SyncCursor,
    $$SyncCursorsTableFilterComposer,
    $$SyncCursorsTableOrderingComposer,
    $$SyncCursorsTableAnnotationComposer,
    $$SyncCursorsTableCreateCompanionBuilder,
    $$SyncCursorsTableUpdateCompanionBuilder,
    (SyncCursor, BaseReferences<_$AppDatabase, $SyncCursorsTable, SyncCursor>),
    SyncCursor,
    PrefetchHooks Function()> {
  $$SyncCursorsTableTableManager(_$AppDatabase db, $SyncCursorsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SyncCursorsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SyncCursorsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SyncCursorsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> ownerUid = const Value.absent(),
            Value<String> node = const Value.absent(),
            Value<DateTime> lastSyncedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              SyncCursorsCompanion(
            ownerUid: ownerUid,
            node: node,
            lastSyncedAt: lastSyncedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String ownerUid,
            required String node,
            required DateTime lastSyncedAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              SyncCursorsCompanion.insert(
            ownerUid: ownerUid,
            node: node,
            lastSyncedAt: lastSyncedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$SyncCursorsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $SyncCursorsTable,
    SyncCursor,
    $$SyncCursorsTableFilterComposer,
    $$SyncCursorsTableOrderingComposer,
    $$SyncCursorsTableAnnotationComposer,
    $$SyncCursorsTableCreateCompanionBuilder,
    $$SyncCursorsTableUpdateCompanionBuilder,
    (SyncCursor, BaseReferences<_$AppDatabase, $SyncCursorsTable, SyncCursor>),
    SyncCursor,
    PrefetchHooks Function()>;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$AccountsTableTableTableManager get accountsTable =>
      $$AccountsTableTableTableManager(_db, _db.accountsTable);
  $$OperationsTableTableTableManager get operationsTable =>
      $$OperationsTableTableTableManager(_db, _db.operationsTable);
  $$PendingSyncItemsTableTableManager get pendingSyncItems =>
      $$PendingSyncItemsTableTableManager(_db, _db.pendingSyncItems);
  $$SyncCursorsTableTableManager get syncCursors =>
      $$SyncCursorsTableTableManager(_db, _db.syncCursors);
}
