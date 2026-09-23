<#
    Extracts the first worksheet of an .xlsx workbook to CSV.

    Reads the OOXML package directly (it is a zip containing XML), so there is
    no npm/Excel dependency — the import script only ever sees a plain,
    eyeball-checkable CSV.

    Usage:
      powershell -ExecutionPolicy Bypass -File scripts/xlsx-to-csv.ps1 `
        -XlsxPath "..\strategy\addis_ababa_training_institutes_contact.xlsx" `
        -CsvPath  "scripts\data\training-institutes.csv"
#>
param(
    [Parameter(Mandatory = $true)][string]$XlsxPath,
    [Parameter(Mandatory = $true)][string]$CsvPath
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$XlsxPath = (Resolve-Path -LiteralPath $XlsxPath).Path
$zip = [System.IO.Compression.ZipFile]::OpenRead($XlsxPath)

function Get-EntryText {
    param([string]$Name)
    $entry = $zip.GetEntry($Name)
    if (-not $entry) { throw "missing zip entry: $Name" }
    $reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
    try { return $reader.ReadToEnd() } finally { $reader.Close() }
}

try {
    # sharedStrings.xml holds every distinct string in the workbook; sheet cells
    # with t="s" carry an index into it rather than the text itself. An <si> is
    # either a single <t>, or a run of <r><t> fragments that must be concatenated.
    $shared = @()
    if ($zip.GetEntry("xl/sharedStrings.xml")) {
        $sst = [xml](Get-EntryText "xl/sharedStrings.xml")
        $shared = @($sst.sst.si | ForEach-Object {
            if ($_.t -is [string])   { $_.t }
            elseif ($_.t.'#text')    { $_.t.'#text' }
            else { ($_.r | ForEach-Object { if ($_.t -is [string]) { $_.t } else { $_.t.'#text' } }) -join '' }
        })
    }

    $sheet = [xml](Get-EntryText "xl/worksheets/sheet1.xml")
    $rows  = @($sheet.worksheet.sheetData.row)
    if ($rows.Count -eq 0) { throw "sheet1 has no rows" }

    # Cell refs are like "C7" — split the column letters off the row number so a
    # row with gaps (Excel omits empty cells entirely) still lands in the right column.
    function Get-ColumnIndex {
        param([string]$Ref)
        $letters = ($Ref -replace '\d', '')
        $n = 0
        foreach ($ch in $letters.ToCharArray()) { $n = $n * 26 + ([int][char]$ch - 64) }
        return $n - 1
    }

    function Get-RowValues {
        param($Row, [int]$Width)
        $values = New-Object string[] $Width
        for ($i = 0; $i -lt $Width; $i++) { $values[$i] = "" }
        foreach ($cell in @($Row.c)) {
            $idx = Get-ColumnIndex $cell.r
            if ($idx -lt 0 -or $idx -ge $Width) { continue }
            if ($cell.t -eq 's' -and $null -ne $cell.v)      { $values[$idx] = $shared[[int]$cell.v] }
            elseif ($cell.t -eq 'inlineStr')                 { $values[$idx] = "$($cell.is.t)" }
            else                                             { $values[$idx] = "$($cell.v)" }
        }
        return $values
    }

    # RFC 4180: quote any field containing a comma, quote or newline; escape
    # embedded quotes by doubling them.
    function ConvertTo-CsvField {
        param([string]$Value)
        if ($null -eq $Value) { return "" }
        if ($Value -match '[",\r\n]') { return '"' + ($Value -replace '"', '""') + '"' }
        return $Value
    }

    $width = (@($rows[0].c)).Count
    $lines = foreach ($row in $rows) {
        ((Get-RowValues -Row $row -Width $width) | ForEach-Object { ConvertTo-CsvField $_ }) -join ','
    }

    $outDir = Split-Path -Parent $CsvPath
    if ($outDir -and -not (Test-Path -LiteralPath $outDir)) {
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    }
    $full = [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $CsvPath))
    # No BOM — the Node-side parser reads this as plain UTF-8.
    [System.IO.File]::WriteAllText($full, ($lines -join "`n") + "`n", (New-Object System.Text.UTF8Encoding($false)))

    Write-Host "wrote $full  ($($rows.Count) rows, $width columns)"
}
finally {
    $zip.Dispose()
}
