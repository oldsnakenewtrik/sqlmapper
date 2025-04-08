# SQL Campaign Mapper

A simple web-based tool for mapping campaign data to pretty names and generating SQL queries.

## Features

- Upload CSV data with campaign information
- Map networks and campaign names to pretty names
- Organize networks and campaigns in a specific order
- Generate SQL queries based on the mappings
- Copy SQL to clipboard
- Filter and search functionality

## Usage

1. Upload a CSV file with campaign data or use the sample data
2. Map the original network and campaign names to pretty names
3. Organize the networks and campaigns in the desired order
4. Generate SQL queries based on your mappings

## CSV Format

The application expects CSV files with the following columns:
- deduced_source
- campaign_name
- campaign_source
- referer_name

## Deployment

This application is deployed on Railway.

## Local Development

To run the application locally:

1. Clone the repository
2. Install dependencies with `npm install`
3. Start the development server with `npm run dev`
4. Open your browser to `http://localhost:3000`

## License

MIT
