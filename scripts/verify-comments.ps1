$postId = $args[0]
if (-not $postId) {
  Write-Host "Usage: .\scripts\verify-comments.ps1 <POST_ID>"
  exit 1
}

$url = "http://localhost:3000/api/posts/$postId/comments"
Write-Host "GET $url"
try {
  $response = Invoke-WebRequest -Uri $url -UseBasicParsing
  Write-Host "Status: $($response.StatusCode)"
  Write-Host $response.Content
} catch {
  Write-Host "Request failed: $($_.Exception.Message)"
  exit 1
}
