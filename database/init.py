from service import (
    application,
    location,
    person,
    question,
)

init_funcs = [
    application.init_db,
    location.init_db,
    question.init_db,
    person.init_db,
]

print('Initializing DB...')
for i, init_func in enumerate(init_funcs, start=1):
    print(f'  * {i} of {len(init_funcs)}')
    init_func()
print('Finished initializing DB')
