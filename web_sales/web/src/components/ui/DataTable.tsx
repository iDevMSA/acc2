import React from 'react';
import { EmptyState, Spinner, cx } from './primitives';
import { IconName } from './Icon';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T, index: number) => React.ReactNode;
  /** الأعمدة الرقمية تُحاذى لنهاية السطر وتُعرض بأرقام متساوية العرض */
  numeric?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T, index: number) => string;
  loading?: boolean;
  empty?: { title: string; description?: string; icon?: IconName };
  footer?: React.ReactNode;
  maxHeight?: string;
}

function DataTable<T>({ columns, rows, rowKey, loading, empty, footer, maxHeight }: DataTableProps<T>) {
  return (
    <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <table className="table-base">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={cx(col.numeric && 'text-end', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center">
                <Spinner />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr className="hover:bg-transparent">
              <td colSpan={columns.length} className="p-0">
                <EmptyState title={empty?.title || 'لا توجد بيانات'} description={empty?.description} icon={empty?.icon} />
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={rowKey(row, i)}>
                {columns.map((col) => (
                  <td key={col.key} className={cx(col.numeric && 'text-end font-medium', col.className)}>
                    {col.numeric ? <span className="num">{col.render(row, i)}</span> : col.render(row, i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer && !loading && rows.length > 0 && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}

export default DataTable;
