param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$sourcePopupPath = Join-Path $Root "docs\assets\popup-reader.png"
$iconPath = Join-Path $Root "public\icons\icon-128.png"
$outDir = Join-Path $Root "docs\store-assets"
$screenshotsDir = Join-Path $outDir "screenshots"

New-Item -ItemType Directory -Force -Path $screenshotsDir | Out-Null

function New-Bitmap([int]$Width, [int]$Height) {
  $bitmap = New-Object System.Drawing.Bitmap $Width, $Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function New-RoundedRectPath([float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Fill-RoundedRect($Graphics, [System.Drawing.Brush]$Brush, [float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius) {
  $path = New-RoundedRectPath $X $Y $Width $Height $Radius
  $Graphics.FillPath($Brush, $path)
  $path.Dispose()
}

function Draw-RoundedRect($Graphics, [System.Drawing.Pen]$Pen, [float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius) {
  $path = New-RoundedRectPath $X $Y $Width $Height $Radius
  $Graphics.DrawPath($Pen, $path)
  $path.Dispose()
}

function Draw-Text($Graphics, [string]$Text, [float]$X, [float]$Y, [float]$Size, [System.Drawing.Color]$Color, [string]$Weight = "Regular", [float]$Width = 520, [float]$Height = 80) {
  $style = if ($Weight -eq "Bold") { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
  $unit = [System.Drawing.GraphicsUnit]::Pixel
  $font = New-Object System.Drawing.Font "Segoe UI", $Size, $style, $unit
  $brush = New-Object System.Drawing.SolidBrush $Color
  $format = New-Object System.Drawing.StringFormat
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $Graphics.DrawString($Text, $font, $brush, (New-Object System.Drawing.RectangleF $X, $Y, $Width, $Height), $format)
  $font.Dispose()
  $brush.Dispose()
  $format.Dispose()
}

function Draw-BrowserMock($Graphics, [float]$X, [float]$Y, [float]$Width, [float]$Height, [string]$Title, [string]$Body, [string]$Accent) {
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255))
  $pale = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(241, 245, 249))
  $line = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(226, 232, 240)), 2
  Fill-RoundedRect $Graphics $white $X $Y $Width $Height 24
  Draw-RoundedRect $Graphics $line $X $Y $Width $Height 24
  Fill-RoundedRect $Graphics $pale ($X + 22) ($Y + 20) ($Width - 44) 36 18
  Draw-Text $Graphics "https://example.com/article" ($X + 48) ($Y + 29) 14 ([System.Drawing.Color]::FromArgb(100, 116, 139)) "Regular" ($Width - 96) 24
  Draw-Text $Graphics $Title ($X + 36) ($Y + 92) 28 ([System.Drawing.Color]::FromArgb(15, 23, 42)) "Bold" ($Width - 72) 84
  Draw-Text $Graphics $Body ($X + 36) ($Y + 190) 18 ([System.Drawing.Color]::FromArgb(71, 85, 105)) "Regular" ($Width - 72) 130
  $accentBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($Accent))
  Fill-RoundedRect $Graphics $accentBrush ($X + 36) ($Y + $Height - 120) ($Width - 72) 64 18
  Draw-Text $Graphics "Clip current page" ($X + 62) ($Y + $Height - 100) 20 ([System.Drawing.Color]::White) "Bold" 320 36
  $white.Dispose()
  $pale.Dispose()
  $line.Dispose()
  $accentBrush.Dispose()
}

function Draw-Screenshot([string]$FileName, [string]$Eyebrow, [string]$Heading, [string]$Body, [string]$Callout, [string]$Accent) {
  $canvas = New-Bitmap 1280 800
  $bitmap = $canvas.Bitmap
  $graphics = $canvas.Graphics
  $background = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle 0, 0, 1280, 800), ([System.Drawing.Color]::FromArgb(248, 250, 252)), ([System.Drawing.Color]::FromArgb(220, 252, 231)), 18
  $graphics.FillRectangle($background, 0, 0, 1280, 800)

  Draw-Text $graphics $Eyebrow 76 72 18 ([System.Drawing.Color]::FromArgb(22, 101, 52)) "Bold" 480 30
  Draw-Text $graphics $Heading 76 112 46 ([System.Drawing.Color]::FromArgb(15, 23, 42)) "Bold" 510 150
  Draw-Text $graphics $Body 78 280 22 ([System.Drawing.Color]::FromArgb(51, 65, 85)) "Regular" 500 120
  Draw-BrowserMock $graphics 76 452 470 250 "Long article ready for clipping" "Open the extension from the toolbar or context menu. Web Clipper reads only the active tab after the user asks it to clip." $Accent

  $popup = [System.Drawing.Image]::FromFile($sourcePopupPath)
  $popupWidth = 520
  $popupHeight = [int]($popup.Height * ($popupWidth / $popup.Width))
  $shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(38, 15, 23, 42))
  Fill-RoundedRect $graphics $shadow 632 70 ($popupWidth + 18) ($popupHeight + 18) 20
  $graphics.DrawImage($popup, 620, 58, $popupWidth, $popupHeight)

  $calloutBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255))
  $calloutPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($Accent)), 3
  Fill-RoundedRect $graphics $calloutBrush 690 662 420 72 18
  Draw-RoundedRect $graphics $calloutPen 690 662 420 72 18
  Draw-Text $graphics $Callout 716 680 20 ([System.Drawing.Color]::FromArgb(15, 23, 42)) "Bold" 368 36

  $popup.Dispose()
  $shadow.Dispose()
  $calloutBrush.Dispose()
  $calloutPen.Dispose()
  $background.Dispose()
  $graphics.Dispose()
  $bitmap.Save((Join-Path $screenshotsDir $FileName), [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

Draw-Screenshot "01-reader-capture-1280x800.png" "WEB CLIPPER FOR IMA" "Capture pages into clean Markdown" "Extract readable content from the active tab, review the result, and keep the source URL with the note." "Three review modes" "#16a34a"
Draw-Screenshot "02-manual-area-1280x800.png" "SELECT EXACT CONTENT" "Clip selected text or a page area" "Use Selection mode or Select Area when a page has extra navigation, ads, or layout noise." "Manual area recovery" "#0f766e"
Draw-Screenshot "03-save-to-ima-1280x800.png" "SAVE TO IMA" "Send the final Markdown to ima" "Connect with your own ima Client ID and API Key, then save as a note or to a knowledge base." "User-initiated save" "#059669"

$promo = New-Bitmap 440 280
$g = $promo.Graphics
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle 0, 0, 440, 280), ([System.Drawing.Color]::FromArgb(236, 253, 245)), ([System.Drawing.Color]::FromArgb(255, 255, 255)), 20
$g.FillRectangle($bg, 0, 0, 440, 280)
$icon = [System.Drawing.Image]::FromFile($iconPath)
$g.DrawImage($icon, 34, 42, 72, 72)
Draw-Text $g "Web Clipper for ima" 126 44 26 ([System.Drawing.Color]::FromArgb(15, 23, 42)) "Bold" 270 42
Draw-Text $g "Clip pages into Markdown, then save to ima." 128 88 17 ([System.Drawing.Color]::FromArgb(71, 85, 105)) "Regular" 260 64
$buttonBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(15, 23, 42))
Fill-RoundedRect $g $buttonBrush 34 178 196 52 16
Draw-Text $g "Copy Markdown" 60 191 18 ([System.Drawing.Color]::White) "Bold" 160 28
$cardBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255))
$cardPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(187, 247, 208)), 2
Fill-RoundedRect $g $cardBrush 260 158 134 88 16
Draw-RoundedRect $g $cardPen 260 158 134 88 16
Draw-Text $g "Save to ima" 280 178 18 ([System.Drawing.Color]::FromArgb(22, 101, 52)) "Bold" 98 26
Draw-Text $g "Note only" 282 206 14 ([System.Drawing.Color]::FromArgb(71, 85, 105)) "Regular" 90 24
$icon.Dispose()
$buttonBrush.Dispose()
$cardBrush.Dispose()
$cardPen.Dispose()
$bg.Dispose()
$g.Dispose()
$promo.Bitmap.Save((Join-Path $outDir "promo-small-440x280.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$promo.Bitmap.Dispose()

Get-ChildItem -Recurse -File $outDir | Select-Object FullName, Length
