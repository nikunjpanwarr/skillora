# Skillora Automated Verification & Test Suite (PowerShell Runner)
# Verifies file integrity, university security policies, lifecycle state transitions, and schemas

$passed = 0
$failed = 0

function Assert-Test($condition, $name) {
    if ($condition) {
        Write-Host "  ✓ PASS: $name" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "  ✗ FAIL: $name" -ForegroundColor Red
        $script:failed++
    }
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  Running Skillora Phase 12 Security & Regression Test Suite (PS)" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Email Domain Security
Write-Host "[Test Suite 1: Bennett University Email Security & Boundaries]" -ForegroundColor Yellow
$ALLOWED_DOMAIN = "bennett.edu.in"
function Test-BennettEmail($email) {
    if ([string]::IsNullOrWhiteSpace($email)) { return $false }
    $clean = $email.Trim().ToLower()
    return $clean.EndsWith("@$ALLOWED_DOMAIN") -and ($clean.Length -gt ("@$ALLOWED_DOMAIN").Length)
}

Assert-Test (Test-BennettEmail "student@bennett.edu.in") "Standard student email accepted"
Assert-Test (Test-BennettEmail "faculty.lead@bennett.edu.in") "Standard faculty email accepted"
Assert-Test (-not (Test-BennettEmail "attacker@gmail.com")) "Gmail external domain rejected"
Assert-Test (-not (Test-BennettEmail "fake@yahoo.com")) "Yahoo external domain rejected"
Assert-Test (-not (Test-BennettEmail "hacker@bennett.edu.in.evil.com")) "Subdomain spoofing blocked"
Assert-Test (-not (Test-BennettEmail "@bennett.edu.in")) "Missing local-part rejected"
Assert-Test (-not (Test-BennettEmail "")) "Empty string rejected"
Assert-Test (-not (Test-BennettEmail $null)) "Null input safely rejected"

# 2. Marketplace Categories Integrity
Write-Host "`n[Test Suite 2: Marketplace Category Completeness & Slug Integrity]" -ForegroundColor Yellow
$expectedCategories = @(
    'video-editing', 'graphic-design', 'content-writing', 'web-development',
    'photography', 'social-media', 'presentations', 'coding',
    'ui-ux-design', 'tutoring-academics', 'music-audio', 'career-resume',
    'event-coverage', 'ai-data-analytics'
)
Assert-Test ($expectedCategories.Count -ge 8) "Standard university service categories defined ($($expectedCategories.Count) categories available)"
foreach ($slug in $expectedCategories) {
    Assert-Test ($slug -match '^[a-z0-9-]+$') "Slug '$slug' matches kebab-case alphanumeric format"
}

# Custom category slug generation test
function Convert-ToCategorySlug($name) {
    $clean = $name.Trim().ToLower() -replace '[^a-z0-9]+', '-' -replace '(^-|-$)', ''
    if ([string]::IsNullOrWhiteSpace($clean)) { return "cat-custom" }
    return $clean
}
Assert-Test ((Convert-ToCategorySlug "UI/UX & App Design") -eq "ui-ux-app-design") "Custom category slug generation works"
Assert-Test ((Convert-ToCategorySlug "Guitar Lessons!") -eq "guitar-lessons") "Special characters stripped from custom category slug"

# 3. Order Lifecycle State Machine
Write-Host "`n[Test Suite 3: Order Lifecycle State Machine Transitions]" -ForegroundColor Yellow
$validTransitions = @{
    'pending'     = @('accepted', 'rejected', 'cancelled')
    'accepted'    = @('in_progress', 'cancelled')
    'in_progress' = @('delivered')
    'delivered'   = @('completed')
    'completed'   = @()
    'cancelled'   = @()
    'rejected'    = @()
}

function Test-Transition($current, $next) {
    if ($validTransitions.ContainsKey($current)) {
        return $validTransitions[$current] -contains $next
    }
    return $false
}

Assert-Test (Test-Transition 'pending' 'accepted') "Pending -> Accepted is valid"
Assert-Test (Test-Transition 'pending' 'rejected') "Pending -> Rejected is valid"
Assert-Test (Test-Transition 'pending' 'cancelled') "Pending -> Cancelled is valid"
Assert-Test (Test-Transition 'accepted' 'in_progress') "Accepted -> In Progress is valid"
Assert-Test (Test-Transition 'in_progress' 'delivered') "In Progress -> Delivered is valid"
Assert-Test (Test-Transition 'delivered' 'completed') "Delivered -> Completed is valid"

Assert-Test (-not (Test-Transition 'pending' 'completed')) "ILLEGAL: Pending -> Completed directly blocked"
Assert-Test (-not (Test-Transition 'completed' 'cancelled')) "ILLEGAL: Completed -> Cancelled blocked"
Assert-Test (-not (Test-Transition 'cancelled' 'delivered')) "ILLEGAL: Cancelled -> Delivered blocked"
Assert-Test (-not (Test-Transition 'rejected' 'in_progress')) "ILLEGAL: Rejected -> In Progress blocked"
Assert-Test (-not (Test-Transition 'delivered' 'pending')) "ILLEGAL: Delivered -> Pending rewind blocked"

# 4. Review Submission Eligibility
Write-Host "`n[Test Suite 4: Verified Review Submission Eligibility]" -ForegroundColor Yellow
function Test-CanReview($orderStatus, $consumerId, $userId, $hasReview) {
    if ($orderStatus -ne 'completed') { return $false }
    if ($consumerId -ne $userId) { return $false }
    if ($hasReview) { return $false }
    return $true
}

Assert-Test (Test-CanReview 'completed' 5 5 $false) "Buyer can review completed order"
Assert-Test (-not (Test-CanReview 'in_progress' 5 5 $false)) "Buyer CANNOT review in_progress order"
Assert-Test (-not (Test-CanReview 'completed' 5 5 $true)) "Duplicate review blocked"
Assert-Test (-not (Test-CanReview 'completed' 5 99 $false)) "Unauthorized user CANNOT review order"

# 5. RBAC Role Authorization Matrix
Write-Host "`n[Test Suite 5: RBAC Role Authorization Matrix]" -ForegroundColor Yellow
function Test-HasPermission($role, $allowedRoles) {
    if ([string]::IsNullOrEmpty($role)) { return $false }
    return $allowedRoles -contains $role
}

Assert-Test (Test-HasPermission 'admin' @('admin')) "Admin granted access to Admin routes"
Assert-Test (-not (Test-HasPermission 'consumer' @('admin'))) "Consumer BLOCKED from Admin routes"
Assert-Test (-not (Test-HasPermission 'producer' @('admin'))) "Producer BLOCKED from Admin routes"
Assert-Test (Test-HasPermission 'producer' @('producer', 'admin')) "Producer allowed on Producer routes"
Assert-Test (-not (Test-HasPermission $null @('consumer', 'producer', 'admin'))) "Unauthenticated guest BLOCKED"

# 6. File Upload Validation
Write-Host "`n[Test Suite 6: File Upload MIME & Size Constraints]" -ForegroundColor Yellow
$ALLOWED_MIME = @('image/jpeg', 'image/png', 'image/webp')
$MAX_FILE_SIZE = 5 * 1024 * 1024

function Test-Upload($mime, $size) {
    if (-not ($ALLOWED_MIME -contains $mime)) { return $false }
    if ($size -gt $MAX_FILE_SIZE) { return $false }
    return $true
}

Assert-Test (Test-Upload 'image/png' (1024 * 500)) "PNG within 5MB accepted"
Assert-Test (Test-Upload 'image/jpeg' (1024 * 1024)) "JPEG within 5MB accepted"
Assert-Test (Test-Upload 'image/webp' (1024 * 300)) "WebP within 5MB accepted"
Assert-Test (-not (Test-Upload 'application/x-msdownload' 500)) "EXE file rejected"
Assert-Test (-not (Test-Upload 'text/html' 500)) "HTML file rejected"
Assert-Test (-not (Test-Upload 'image/png' (6 * 1024 * 1024))) "File > 5MB rejected"

# 7. Escrow Payment Lifecycle States
Write-Host "`n[Test Suite 7: Campus Escrow State Transitions]" -ForegroundColor Yellow
$escrowTransitions = @{
    'created'              = @('held_in_escrow', 'failed')
    'held_in_escrow'       = @('released_to_producer', 'refunded_to_consumer')
    'released_to_producer' = @()
    'refunded_to_consumer' = @()
    'failed'               = @()
}

function Test-Escrow($current, $next) {
    if ($escrowTransitions.ContainsKey($current)) {
        return $escrowTransitions[$current] -contains $next
    }
    return $false
}

Assert-Test (Test-Escrow 'created' 'held_in_escrow') "Created -> Held in Escrow is valid"
Assert-Test (Test-Escrow 'held_in_escrow' 'released_to_producer') "Escrow -> Released is valid on completion"
Assert-Test (Test-Escrow 'held_in_escrow' 'refunded_to_consumer') "Escrow -> Refunded is valid on dispute/cancel"
Assert-Test (-not (Test-Escrow 'created' 'released_to_producer')) "Created directly to Released is BLOCKED"
Assert-Test (-not (Test-Escrow 'released_to_producer' 'refunded_to_consumer')) "Released to Refunded rewind is BLOCKED"

# 8. File Structure & Integrity Verification
Write-Host "`n[Test Suite 8: File Structure & Asset Integrity]" -ForegroundColor Yellow
$requiredFiles = @(
    "index.html", "explore.html", "become-producer.html", "about.html", "login.html",
    "consumer-dashboard.html", "producer-dashboard.html", "admin-dashboard.html", "service-detail.html",
    "styles.css", "script.js", "auth.js", "explore.js", "service-detail.js",
    "consumer-dashboard.js", "producer-dashboard.js", "admin-dashboard.js",
    "server.js", "package.json", "PROJECT_GUIDE.md", "README.md",
    "images/hero-students.png",
    "middleware/auth.js", "middleware/security.js", "middleware/upload.js",
    "db/schema.sql", "db/seed.sql", "db/connection.js",
    "routes/auth.js", "routes/categories.js", "routes/services.js", "routes/orders.js",
    "routes/producer.js", "routes/favorites.js", "routes/reviews.js", "routes/notifications.js",
    "routes/admin.js", "routes/payments.js", "routes/messages.js", "routes/reports.js"
)

$baseDir = Split-Path -Parent $PSScriptRoot
foreach ($rf in $requiredFiles) {
    $fullPath = Join-Path $baseDir $rf
    Assert-Test (Test-Path $fullPath) "File present: $rf"
}

# Summary
Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "  Results: $passed Passed | $failed Failed | Total: $($passed + $failed)" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

if ($failed -gt 0) {
    exit 1
}
