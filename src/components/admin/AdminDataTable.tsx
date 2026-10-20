/**
 * 🧱 2026-06-10 어드민 대시보드 공통 데이터 테이블 (라이트 테마 고정 — `dark:` 금지 영역).
 *
 * 기존 어드민 테이블 관행(AdminWholesaleOrdersPage / AdminWholesaleIntegrityPage /
 * AdminWholesaleDepositsPage 등)을 그대로 컴포넌트화:
 *   - 래퍼: bg-white rounded-xl border border-gray-200
 *   - 데스크톱(sm+): <table className="w-full text-sm"> + thead text-gray-500 /
 *     th py-2.5 px-4 font-medium / tbody tr border-b border-gray-50
 *   - 모바일(sm 미만): label-value 카드 리스트로 자동 전환 (가로 스크롤 테이블 대체)
 *   - 로딩: 스피너 row / 빈 상태: empty 문구(노드 허용) row
 *
 * 사용 예:
 *   <AdminDataTable<OrderRow>
 *     columns={[{ key: 'id', label: '주문' }, { key: 'amount', label: '금액', className: 'text-right', render: o => formatWon(o.amount) }]}
 *     rows={orders}
 *     loading={loading}
 *     empty="주문이 없습니다."
 *     rowKey={o => o.id}
 *     onRowClick={o => openDetail(o.id)}
 *   />
 *
 * 레퍼런스 적용: AdminWholesaleOrdersPage, AdminWholesaleIntegrityPage.
 */
import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export interface AdminDataTableColumn<T> {
  /** 컬럼 고유 key. render 미지정 시 row[key] 값을 문자열로 표시 (null/undefined/'' → '-') */
  key: string
  label: ReactNode
  render?: (row: T) => ReactNode
  /** <th> + <td> 공통 추가 클래스 — 정렬 등 (예: 'text-right'). 모바일 카드에는 미적용. */
  className?: string
}

export interface AdminDataTableProps<T> {
  columns: Array<AdminDataTableColumn<T>>
  rows: T[]
  loading?: boolean
  /** 빈 상태 문구 (ReactNode 허용 — 아이콘 포함 가능) */
  empty?: ReactNode
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  /** body <tr> 추가 클래스 (예: 'align-top') */
  rowClassName?: string
}

function cellContent<T>(row: T, col: AdminDataTableColumn<T>): ReactNode {
  if (col.render) return col.render(row)
  const v = (row as unknown as Record<string, unknown>)[col.key]
  if (v === null || v === undefined || v === '') return '-'
  return String(v)
}

export default function AdminDataTable<T>({
  columns,
  rows,
  loading = false,
  empty = '데이터가 없습니다.',
  rowKey,
  onRowClick,
  rowClassName,
}: AdminDataTableProps<T>) {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* 데스크톱 (sm+): 테이블 */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              {columns.map(col => (
                <th key={col.key} className={`py-2.5 px-4 font-medium ${col.className || ''}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400 inline-block" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 px-4 text-center text-gray-400">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-gray-50 ${onRowClick ? 'hover:bg-gray-50 cursor-pointer' : ''} ${rowClassName || ''}`}
                >
                  {columns.map(col => (
                    <td key={col.key} className={`py-2.5 px-4 text-gray-700 ${col.className || ''}`}>
                      {cellContent(row, col)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 모바일 (sm 미만): 카드 리스트 */}
      <div className="sm:hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 px-4 text-center text-gray-400 text-sm">{empty}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map(row => (
              <div
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`px-4 py-3 space-y-1.5 ${onRowClick ? 'cursor-pointer active:bg-gray-50' : ''}`}
              >
                {columns.map(col => (
                  <div key={col.key} className="flex items-start justify-between gap-3">
                    <span className="text-xs text-gray-500 font-medium shrink-0 pt-0.5">{col.label}</span>
                    <div className="text-sm text-gray-700 text-right min-w-0 break-words">
                      {cellContent(row, col)}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
