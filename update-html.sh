#!/bin/bash

# Find all HTML files in the ICB-Tracking-System-main/public directory
find ICB-Tracking-System-main/public -name "*.html" -type f | while read html_file; do
  # Check if the file already includes config.js
  if ! grep -q "config.js" "$html_file"; then
    # If it includes any scripts, add config.js before the first script
    if grep -q "<script" "$html_file"; then
      # Add config.js before the first script
      sed -i '' 's/<script/<script src="..\/config.js"><\/script>\n    <script/g' "$html_file"
      echo "Updated $html_file to include config.js"
    else
      # If it has no scripts, add config.js before </body>
      sed -i '' 's/<\/body>/<script src="..\/config.js"><\/script>\n<\/body>/g' "$html_file"
      echo "Added config.js to $html_file"
    fi
  else
    echo "$html_file already includes config.js"
  fi
done

echo "All HTML files have been updated." 