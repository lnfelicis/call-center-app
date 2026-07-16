import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";

import { DataTable } from "@/components/data-table";
import type { DataTableColumn } from "@/components/data-table";
import { OptionBadge } from "@/components/option-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CallFormOption,
  CategoryReport,
  ManagedUser,
  ReportCall,
  ReportExport,
  ReportsSummary,
  RequestFn,
  StaffReport,
} from "@/types";

type ReportsModuleProps = {
  request: RequestFn;
  users: ManagedUser[];
  canExport: boolean;
  canViewAllCalls: boolean;
};

type SearchFilters = {
  phoneNumber: string;
  studentTc: string;
  studentName: string;
  recordNumber: string;
  category: string;
  status: string;
  priority: string;
  openedByUserId: string;
};

const emptyFilters: SearchFilters = {
  phoneNumber: "",
  studentTc: "",
  studentName: "",
  recordNumber: "",
  category: "all",
  status: "all",
  priority: "all",
  openedByUserId: "",
};

export function ReportsModule({
  request,
  users,
  canExport,
  canViewAllCalls,
}: ReportsModuleProps) {
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [calls, setCalls] = useState<ReportCall[]>([]);
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [staff, setStaff] = useState<StaffReport[]>([]);
  const [categories, setCategories] = useState<CategoryReport[]>([]);
  const [filterOptions, setFilterOptions] = useState<CallFormOption[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const categoryOptions = filterOptions.filter(
    (option) => option.type === "issue_category" && option.isActive,
  );
  const statusOptions = filterOptions.filter(
    (option) => option.type === "status" && option.isActive,
  );
  const priorityOptions = filterOptions.filter(
    (option) => option.type === "priority" && option.isActive,
  );

  const optionLabel = useCallback(
    (type: CallFormOption["type"], value: string) => {
      return (
        filterOptions.find(
          (option) => option.type === type && option.value === value,
        )?.label ?? value
      );
    },
    [filterOptions],
  );

  const optionColor = useCallback(
    (type: CallFormOption["type"], value: string) => {
      return (
        filterOptions.find(
          (option) => option.type === type && option.value === value,
        )?.color ?? null
      );
    },
    [filterOptions],
  );

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const [summaryData, staffData, categoryData, filterData, searchData] =
        await Promise.all([
          request<ReportsSummary>("/reports/summary"),
          request<{ staff: StaffReport[] }>("/reports/staff"),
          request<{ categories: CategoryReport[] }>("/reports/categories"),
          request<{ options: CallFormOption[] }>("/reports/filters"),
          request<{ calls: ReportCall[] }>(
            `/calls/search?${buildQuery(filters)}`,
          ),
        ]);

      setSummary(summaryData);
      setStaff(staffData.staff);
      setCategories(categoryData.categories);
      setFilterOptions(filterData.options);
      setCalls(searchData.calls);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Raporlar yüklenemedi.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [filters, request]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const callColumns = useMemo<Array<DataTableColumn<ReportCall>>>(
    () => [
      {
        id: "recordNumber",
        header: "Çağrı Kayıt No",
        size: 260,
        minSize: 240,
        maxSize: 320,
        className: "whitespace-nowrap",
        cell: (call) => (
          <span className="font-medium text-foreground">
            {call.recordNumber}
          </span>
        ),
        accessor: (call) => call.recordNumber,
      },
      {
        id: "student",
        header: "Öğrenci",
        size: 220,
        cell: (call) => (
          <div className="grid gap-1">
            <span className="truncate text-foreground">
              {call.studentName ?? "-"}
            </span>
            <span className="text-xs">{call.studentTc ?? "-"}</span>
          </div>
        ),
        accessor: (call) => `${call.studentName ?? ""} ${call.studentTc ?? ""}`,
      },
      {
        id: "phone",
        header: "Telefon",
        size: 150,
        cell: (call) => call.phoneNumber,
        accessor: (call) => call.phoneNumber,
      },
      {
        id: "category",
        header: "Kategori",
        size: 180,
        cell: (call) => call.category,
        accessor: (call) => call.category,
      },
      {
        id: "status",
        header: "Durum",
        size: 130,
        cell: (call) => (
          <OptionBadge
            label={optionLabel("status", call.status)}
            color={optionColor("status", call.status)}
            fallbackVariant="outline"
          />
        ),
        accessor: (call) => optionLabel("status", call.status),
      },
      {
        id: "priority",
        header: "Öncelik",
        size: 120,
        cell: (call) => (
          <OptionBadge
            label={optionLabel("priority", call.priority)}
            color={optionColor("priority", call.priority)}
            fallbackVariant={
              call.priority === "urgent" ? "default" : "secondary"
            }
          />
        ),
        accessor: (call) => optionLabel("priority", call.priority),
      },
      {
        id: "openedBy",
        header: "Açan",
        size: 180,
        cell: (call) => call.openedByName,
        accessor: (call) => call.openedByName,
      },
      {
        id: "createdAt",
        header: "Tarih",
        size: 150,
        cell: (call) => formatDate(call.createdAt),
        accessor: (call) => call.createdAt,
      },
    ],
    [optionColor, optionLabel],
  );

  async function exportReport(format: "excel" | "pdf") {
    setIsLoading(true);
    setMessage("");

    try {
      const data = await request<ReportExport>(
        `/reports/export?format=${format}&${buildQuery(filters)}`,
      );
      downloadBase64File(data.fileName, data.mimeType, data.content);
      setMessage("Rapor dışa aktarıldı.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Rapor dışa aktarılamadı.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      {message && (
        <p className="rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Metric label="Toplam" value={summary?.summary.total ?? 0} />
        <Metric label="Aktif" value={summary?.summary.open ?? 0} />
        <Metric label="Çözülen" value={summary?.summary.resolved ?? 0} />
        <Metric label="Takip" value={summary?.summary.followUp ?? 0} />
        <Metric label="Acil" value={summary?.summary.urgent ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kayıt Arama</CardTitle>
          <CardDescription>
            Yetki kapsamınıza giren çağrı kayıtlarında filtreli arama yapın.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterInput
              label="Telefon"
              value={filters.phoneNumber}
              onChange={(phoneNumber) =>
                setFilters((current) => ({ ...current, phoneNumber }))
              }
            />
            <FilterInput
              label="TC Kimlik No"
              value={filters.studentTc}
              onChange={(studentTc) =>
                setFilters((current) => ({ ...current, studentTc }))
              }
            />
            <FilterInput
              label="Öğrenci"
              value={filters.studentName}
              onChange={(studentName) =>
                setFilters((current) => ({ ...current, studentName }))
              }
            />
            <FilterInput
              label="Çağrı Kayıt No"
              value={filters.recordNumber}
              onChange={(recordNumber) =>
                setFilters((current) => ({ ...current, recordNumber }))
              }
            />
            <OptionSelect
              label="Kategori"
              value={filters.category}
              onChange={(category) =>
                setFilters((current) => ({ ...current, category }))
              }
              options={categoryOptions}
            />
            <OptionSelect
              label="Durum"
              value={filters.status}
              onChange={(status) =>
                setFilters((current) => ({ ...current, status }))
              }
              options={statusOptions}
            />
            <OptionSelect
              label="Öncelik"
              value={filters.priority}
              onChange={(priority) =>
                setFilters((current) => ({ ...current, priority }))
              }
              options={priorityOptions}
            />
            {canViewAllCalls && (
              <UserSelect
                label="Kaydı açan"
                users={users}
                value={filters.openedByUserId}
                onChange={(openedByUserId) =>
                  setFilters((current) => ({ ...current, openedByUserId }))
                }
              />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void loadReports()}
              disabled={isLoading}
            >
              <Search />
              Ara
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFilters(emptyFilters)}
            >
              <RefreshCw />
              Temizle
            </Button>
            {canExport && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void exportReport("excel")}
                  disabled={isLoading}
                >
                  <Download />
                  Excel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void exportReport("pdf")}
                  disabled={isLoading}
                >
                  <Download />
                  PDF
                </Button>
              </>
            )}
          </div>
          <DataTable
            columns={callColumns}
            data={calls}
            getRowId={(call) => call.id}
            emptyText="Arama sonucunda kayıt bulunamadı."
            searchPlaceholder="Sonuçlarda ara..."
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard
          title="Personel Raporu"
          items={staff.map((item) => ({
            label: item.fullName,
            value: item.openedTotal,
            detail: `${item.resolvedTotal} çözülen`,
          }))}
        />
        <BreakdownCard
          title="Kategori Raporu"
          items={categories.map((item) => ({
            label: item.category,
            value: item.total,
            detail: `${item.openTotal} aktif · ${item.resolvedTotal} çözülen`,
          }))}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <strong className="block text-2xl font-semibold">{value}</strong>
        <span className="text-sm text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

function FilterInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function OptionSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: CallFormOption[];
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value || "all"} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tümü</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function UserSelect({
  label,
  users,
  value,
  onChange,
}: {
  label: string;
  users: ManagedUser[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select
        value={value || "all"}
        onValueChange={(nextValue) =>
          onChange(nextValue === "all" ? "" : nextValue)
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tümü</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function BreakdownCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number; detail: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Operasyonel dağılım özeti.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Henüz raporlanacak kayıt yok.
          </p>
        )}
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0">
              <strong className="block truncate text-sm font-medium">
                {item.label}
              </strong>
              <span className="text-xs text-muted-foreground">
                {item.detail}
              </span>
            </div>
            <Badge variant="secondary">{item.value}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function buildQuery(filters: SearchFilters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "all") {
      params.set(key, value);
    }
  });

  return params.toString();
}

function downloadBase64File(
  fileName: string,
  mimeType: string,
  content: string,
) {
  const byteCharacters = atob(content);
  const byteNumbers = Array.from(byteCharacters, (character) =>
    character.charCodeAt(0),
  );
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
