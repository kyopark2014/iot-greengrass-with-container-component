sudo /greengrass/v2/bin/greengrass-cli deployment create \
  --recipeDir ./recipes \
  --artifactDir ./artifacts \
  --merge "com.component.subscriber=1.0.0"
  