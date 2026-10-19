import React, { useState } from 'react';
import { PageHeader, Tabs } from '../components/ui/primitives';
import InvoiceList from './invoices/InvoiceList';
import ProfitabilityView from './invoices/ProfitabilityView';

type InvoicesTab = 'list' | 'profitability';

const Invoices: React.FC = () => {
  const [tab, setTab] = useState<InvoicesTab>('list');

  return (
    <>
      <PageHeader
        title="الفواتير"
        description={tab === 'list' ? 'كل فواتير البيع من نقاط البيع' : 'تحليل ربحية كل فاتورة على مستوى الأصناف'}
        actions={
          <Tabs<InvoicesTab>
            value={tab}
            onChange={setTab}
            items={[
              { value: 'list', label: 'كل الفواتير', icon: 'receipt' },
              { value: 'profitability', label: 'تحليل الربحية', icon: 'trendUp' },
            ]}
          />
        }
      />
      {tab === 'list' ? <InvoiceList /> : <ProfitabilityView />}
    </>
  );
};

export default Invoices;
