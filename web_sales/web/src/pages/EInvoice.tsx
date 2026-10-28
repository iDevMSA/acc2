import React, { useState } from 'react';
import { Badge, PageHeader, Spinner, Tabs } from '../components/ui/primitives';
import { Segmented } from '../components/ui/Form';
import { useApp } from '../context/AppContext';
import { useLedger } from '../context/LedgerContext';
import { useTaxSettings } from '../hooks/useTaxSettings';
import { Provider, saveEinvoice, useEinvoice } from '../lib/einvoice';
import DocumentsTab from '../components/einvoice/DocumentsTab';
import { EtaTab, PartiesTab, SellerTab, SettingsTab, ZatcaTab } from '../components/einvoice/SetupTabs';

type Tab = 'docs' | 'seller' | 'connect' | 'parties' | 'settings';

// الفوترة الإلكترونية: ZATCA المرحلة الثانية (السعودية) ومنظومة الفاتورة الإلكترونية المصرية (ETA)
const EInvoice: React.FC = () => {
  const { user } = useApp();
  const uid = user?.uid || null;
  const { company } = useLedger();
  const { settings: tax } = useTaxSettings(uid);
  const data = useEinvoice(uid);
  const [tab, setTab] = useState<Tab>('docs');

  const provider: Provider = data.settings.provider || (tax?.countryCode === 'EG' ? 'eta' : 'zatca');
  const s = data.seller;
  const sellerReady =
    provider === 'zatca'
      ? !!(s?.name && s.vatNumber && s.crn && s.street && s.building && s.district && s.city && s.postalCode)
      : !!(s?.name && s.vatNumber && s.activityCode && s.governate && s.city && s.street && s.building);
  const connected = sellerReady && (provider === 'zatca' ? data.zatca?.status === 'ready' : !!data.eta);

  if (!uid || data.loading)
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );

  return (
    <>
      <PageHeader
        title="الفوترة الإلكترونية"
        description={
          provider === 'zatca'
            ? 'هيئة الزكاة والضريبة والجمارك — المرحلة الثانية (الربط والتكامل)'
            : 'مصلحة الضرائب المصرية — منظومة الفاتورة الإلكترونية'
        }
        actions={
          <div className="flex items-center gap-3">
            <Badge tone={connected ? 'success' : 'warning'}>{connected ? 'مربوط' : 'غير مربوط'}</Badge>
            <div className="w-56">
              <Segmented
                value={provider}
                onChange={(v) => saveEinvoice(uid, { 'settings/provider': v })}
                options={[
                  { value: 'zatca', label: 'السعودية' },
                  { value: 'eta', label: 'مصر' },
                ]}
              />
            </div>
          </div>
        }
      />
      <div className="mb-5">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'docs', label: 'المستندات', icon: 'receipt' },
            { value: 'seller', label: 'بيانات المنشأة', icon: 'building' },
            { value: 'connect', label: provider === 'zatca' ? 'الربط مع ZATCA' : 'الربط مع ETA', icon: 'link' },
            { value: 'parties', label: 'بيانات العملاء', icon: 'users' },
            { value: 'settings', label: 'الإعدادات', icon: 'settings' },
          ]}
        />
      </div>
      {tab === 'docs' && <DocumentsTab uid={uid} data={data} provider={provider} connected={connected} />}
      {tab === 'seller' && (
        <SellerTab
          uid={uid}
          data={data}
          provider={provider}
          defaults={{ name: company.name, vatNumber: tax?.trn || '', street: company.address }}
        />
      )}
      {tab === 'connect' && (provider === 'zatca' ? <ZatcaTab data={data} sellerReady={sellerReady} /> : <EtaTab data={data} />)}
      {tab === 'parties' && <PartiesTab uid={uid} data={data} provider={provider} />}
      {tab === 'settings' && <SettingsTab uid={uid} data={data} provider={provider} />}
    </>
  );
};

export default EInvoice;
