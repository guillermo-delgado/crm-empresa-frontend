function TableRowSkeleton() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 bg-slate-200 rounded" />
        </td>
      ))}
    </tr>
  );
}

export default function VentasTableSkeleton({ rows = 6 }) {
  return (
    <table className="w-full border-collapse">
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} />
        ))}
      </tbody>
    </table>
  );
}
