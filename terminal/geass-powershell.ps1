function global:prompt {
    $esc = [char]27
    $crimson = "$esc[38;2;240;90;130m"
    $gold = "$esc[38;2;231;188;93m"
    $violet = "$esc[38;2;201;168;242m"
    $reset = "$esc[0m"
    return "$crimson◈$reset $gold$(Get-Location)$reset $violet❯$reset "
}

Write-Host "GEASS REQUIEM // terminal contract active" -ForegroundColor DarkMagenta
