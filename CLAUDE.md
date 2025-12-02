# CLAUDE.md

This file provides guidance for AI assistants working with the Hacker News API documentation repository.

## Repository Overview

This is the **official Hacker News API documentation** maintained by Y Combinator in partnership with Firebase. It is a documentation-only repository - there is no application code, just API documentation.

**Repository purpose**: Document the public Hacker News API that provides real-time access to HN data via Firebase.

**Base API URL**: `https://hacker-news.firebaseio.com/v0/`

## Repository Structure

```
/
├── README.md    # Main API documentation (primary file)
├── LICENSE      # MIT License (Y Combinator, 2025)
└── CLAUDE.md    # This file
```

## Key Documentation Content (README.md)

The README.md contains comprehensive API documentation covering:

### Data Endpoints

| Endpoint | Description |
|----------|-------------|
| `/v0/item/<id>.json` | Individual items (stories, comments, jobs, polls) |
| `/v0/user/<id>.json` | User profiles |
| `/v0/maxitem.json` | Largest item ID |
| `/v0/topstories.json` | Top 500 stories |
| `/v0/newstories.json` | Newest 500 stories |
| `/v0/beststories.json` | Best stories |
| `/v0/askstories.json` | Latest 200 Ask HN stories |
| `/v0/showstories.json` | Latest 200 Show HN stories |
| `/v0/jobstories.json` | Latest 200 job stories |
| `/v0/updates.json` | Changed items and profiles |

### Item Types

- **story** - Regular HN stories
- **comment** - Comments on items
- **job** - Job postings
- **poll** - Polls
- **pollopt** - Poll options

### Item Fields

Required: `id` (unique integer)

Optional: `deleted`, `type`, `by`, `time`, `text`, `dead`, `parent`, `poll`, `kids`, `url`, `score`, `title`, `parts`, `descendants`

### User Fields

Required: `id`, `created`, `karma`

Optional: `about`, `submitted`

## Contribution Guidelines

### When Modifying README.md

1. **Preserve existing structure** - The documentation follows a logical flow from overview to specific endpoints
2. **Maintain backward compatibility notes** - Only removal of non-optional fields or alteration of existing fields are breaking changes
3. **Include examples** - All endpoints should have JSON response examples with `?print=pretty`
4. **Use Markdown tables** for field documentation
5. **Keep code blocks** in JavaScript format for JSON examples

### Content Standards

- API endpoint URLs must be fully qualified (include full Firebase URL)
- JSON examples should be formatted with `?print=pretty` parameter
- Field descriptions should be concise but complete
- Mark required fields as **bold** in tables

### Bug Reports

Direct users to email: api@ycombinator.com

## Technical Notes for AI Assistants

### API Characteristics

- **No rate limit** currently in place
- **Real-time updates** via Firebase subscriptions
- **Case-sensitive** user IDs
- **Unix timestamps** for all time fields
- **HTML content** in `text`, `about`, and `title` fields

### Common Patterns

1. **Traversing comments**: Load item, get `kids` array, recursively load each child
2. **Finding total comments**: Use `descendants` field or traverse tree and count
3. **Walking all items**: Start at `maxitem` and decrement
4. **Tracking changes**: Subscribe to `/v0/updates` endpoint

### Versioning Policy

- Current version: `v0`
- Breaking changes: Removal of non-optional fields or alteration of existing fields
- Non-breaking: Adding new fields (clients should ignore unexpected fields)

## License

MIT License - Y Combinator Hacker News (2025)
