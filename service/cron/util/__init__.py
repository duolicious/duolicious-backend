import traceback

def join_lists_of_dicts(list1, list2, join_key):
    lookup1 = {item[join_key]: item for item in list1}
    lookup2 = {item[join_key]: item for item in list2}

    common_keys = set(lookup1.keys()) & set(lookup2.keys())

    return [lookup1[k] | lookup2[k] for k in common_keys]

async def print_stacktrace(fun):
    try:
        await fun()
    except:
        print(traceback.format_exc())
