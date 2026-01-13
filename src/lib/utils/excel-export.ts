import * as XLSX from 'xlsx'

export interface ExportColumn<T> {
  header: string
  accessor: keyof T | ((item: T) => string | number | null | undefined)
  width?: number
}

export interface ExportOptions {
  filename: string
  sheetName?: string
}

export interface SheetData {
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ExportColumn<any>[]
}

/**
 * 데이터를 Excel 형식의 ArrayBuffer로 변환
 */
export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions
): ArrayBuffer {
  // 헤더 행 생성
  const headers = columns.map((col) => col.header)

  // 데이터 행 생성
  const rows = data.map((item) =>
    columns.map((col) => {
      if (typeof col.accessor === 'function') {
        return col.accessor(item) ?? ''
      }
      return item[col.accessor] ?? ''
    })
  )

  // 워크시트 생성
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // 컬럼 너비 설정
  const colWidths = columns.map((col) => ({
    wch: col.width || 15,
  }))
  worksheet['!cols'] = colWidths

  // 워크북 생성
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    options.sheetName || 'Sheet1'
  )

  // ArrayBuffer로 변환
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return buffer
}

/**
 * 다중 시트를 포함한 Excel 파일 생성
 */
export function exportToExcelMultiSheet(
  sheets: SheetData[]
): ArrayBuffer {
  const workbook = XLSX.utils.book_new()

  for (const sheet of sheets) {
    // 헤더 행 생성
    const headers = sheet.columns.map((col) => col.header)

    // 데이터 행 생성
    const rows = sheet.data.map((item) =>
      sheet.columns.map((col) => {
        if (typeof col.accessor === 'function') {
          return col.accessor(item) ?? ''
        }
        return item[col.accessor as string] ?? ''
      })
    )

    // 워크시트 생성
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])

    // 컬럼 너비 설정
    const colWidths = sheet.columns.map((col) => ({
      wch: col.width || 15,
    }))
    worksheet['!cols'] = colWidths

    // 시트 이름 정리 (Excel 시트 이름 제한: 31자, 특수문자 제외)
    const sheetName = sheet.name.substring(0, 31).replace(/[\\/*?:\[\]]/g, '')
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  // ArrayBuffer로 변환
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return buffer
}

// 라벨 매핑
export const TYPE_LABELS: Record<string, string> = {
  feature_add: '기능추가',
  feature_improve: '기능개선',
  bug_fix: '버그수정',
  other: '기타',
}

export const STATUS_LABELS: Record<string, string> = {
  requested: '요청',
  reviewing: '검토중',
  processing: '처리중',
  completed: '완료',
  rejected: '반려',
}

export const PRIORITY_LABELS: Record<string, string> = {
  urgent: '긴급',
  high: '높음',
  medium: '보통',
  low: '낮음',
}

export const CONVERSATION_STATUS_LABELS: Record<string, string> = {
  active: '진행중',
  confirmed: '확정',
  archived: '보관',
}
