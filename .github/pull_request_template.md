## Summary

What problem does this PR solve? Why does it matter?

## Changes

- Bullet the key changes

## How to test

Copy-pasteable steps that a reviewer can run locally:

```bash
# Start stack
docker compose up -d
# Optional: seed a user
./test/util/create-user.sh alice 30 1
# Run a representative test
./test/util/with-container.sh ./test/functionality1/status.sh
```

## Checklist

- [ ] I described the problem and solution
- [ ] I added tests or covered by existing tests
- [ ] `./mypy.sh` passes locally
- [ ] I ran at least one functionality test via `with-container.sh`
- [ ] I updated docs (README/DEVELOPER/CONTRIBUTING) if needed
- [ ] I self-reviewed my code

## Screenshots / Notes (optional)

Add images, logs, or additional context here.
