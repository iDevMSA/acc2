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
  onRowClick?: (row: T) => void;
  /** على الهاتف (أصغر من md) يُعرض كل صف كبطاقة بدل الجدول */
  mobileCard?: (row: T, index: number) => React.ReactNode;
  /** ملخص يظهر أسفل البطاقات على الهاتف (بديل footer) */
  mobileFooter?: React.ReactNode;
}

function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  footer,
  maxHeight,
  onRowClick,
  mobileCard,
  mobileFooter,
}: DataTableProps<T>) {
  const emptyState = (
    <EmptyState title={empty?.title || 'لا توجد بيانات'} description={empty?.description} icon={empty?.icon} />
  );

  return (
    <>
      {mobileCard && (
        <div className="md:hidden">
          {loading ? (
            <div className="grid place-items-center py-12">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            emptyState
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((row, i) => (
                <li key={rowKey(row, i)}>
                  {onRowClick ? (
                    <button
                      onClick={() => onRowClick(row)}
                      className="block w-full px-4 py-3.5 text-start transition active:bg-slate-100"
                    >
                      {mobileCard(row, i)}
                    </button>
                  ) : (
                    <div className="px-4 py-3.5">{mobileCard(row, i)}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {mobileFooter && !loading && rows.length > 0 && (
            <div className="border-t border-line-strong bg-slate-50 px-4 py-3 text-sm font-semibold">
              {mobileFooter}
            </div>
          )}
        </div>
      )}
      <div
        className={cx('overflow-auto', mobileCard && 'hidden md:block')}
        style={maxHeight ? { maxHeight } : undefined}
      >
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
                  {emptyState}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={rowKey(row, i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                >
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
    </>
  );
}

export default DataTable;
